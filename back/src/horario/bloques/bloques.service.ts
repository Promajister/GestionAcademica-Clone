import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrigenAsignatura, Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { BloqueExternoDto } from './dto/bloque-externo.dto';
import { QueryBloqueDto } from './dto/query-bloque.dto';

type Tx = Prisma.TransactionClient;

// Las horas "HH:mm" se comparan como string: el orden lexicográfico coincide con el cronológico
const seSuperponen = (
  a: { hora_inicio: string; hora_fin: string },
  b: { hora_inicio: string; hora_fin: string },
) => a.hora_inicio < b.hora_fin && b.hora_inicio < a.hora_fin;

const rango = (b: BloqueExternoDto) =>
  `${b.dia} ${b.hora_inicio}-${b.hora_fin}`;

@Injectable()
export class BloquesService {
  constructor(private prisma: PrismaService) {}

  // ---------- GET /horario/bloques ----------
  // Cada bloque expone `origen` y `bloqueado` para que la grilla distinga los
  // externos y desactive su arrastre (ADM-F02 CA2 y CA3).
  async findAll(q: QueryBloqueDto) {
    const bloques = await this.prisma.bloque_horario.findMany({
      where: {
        dia: q.dia,
        id_sala: q.id_sala,
        ...(q.origen && { curso: { asignatura: { origen: q.origen } } }),
      },
      include: {
        sala: true,
        curso: {
          include: {
            asignatura: {
              select: {
                id_asignatura: true,
                codigo: true,
                nombre: true,
                semestre: true,
                origen: true,
              },
            },
          },
        },
      },
      orderBy: [{ dia: 'asc' }, { hora_inicio: 'asc' }],
    });

    return bloques.map((b) => ({ ...b, origen: b.curso.asignatura.origen }));
  }

  // ---------- Registro de bloques de asignaturas EXTERNAS (ADM-F02-T3) ----------
  // Con `reemplazar` se borran antes los bloques actuales del curso (edición del mantenedor).
  async crearExternos(
    tx: Tx,
    id_asignatura: number,
    bloques: BloqueExternoDto[],
    { reemplazar = false } = {},
  ) {
    const asignatura = await tx.asignatura.findUnique({
      where: { id_asignatura },
      include: { cursos: { orderBy: { id_curso: 'asc' }, take: 1 } },
    });
    if (!asignatura) throw new NotFoundException('Asignatura no encontrada');
    if (asignatura.origen !== OrigenAsignatura.EXTERNA) {
      throw new BadRequestException(
        'Solo las asignaturas externas permiten fijar bloques bloqueados manualmente en este mantenedor.',
      );
    }
    const curso = asignatura.cursos[0];
    if (!curso) {
      throw new NotFoundException('La asignatura no tiene un curso asociado');
    }

    this.validarForma(bloques);

    if (reemplazar) {
      await tx.bloque_horario.deleteMany({
        where: { id_curso: curso.id_curso },
      });
    }

    await this.validarSalas(tx, bloques);
    await this.validarChoques(tx, bloques, curso.id_curso);

    await tx.bloque_horario.createMany({
      data: bloques.map((b) => ({
        dia: b.dia,
        hora_inicio: b.hora_inicio,
        hora_fin: b.hora_fin,
        bloque_numero: b.bloque_numero,
        id_sala: b.id_sala ?? null,
        sala_externa: b.sala_externa ?? null,
        id_curso: curso.id_curso,
        bloqueado: true, // ADM-F02 CA2: los externos nunca se mueven
      })),
    });

    return tx.bloque_horario.findMany({
      where: { id_curso: curso.id_curso },
      include: { sala: true },
      orderBy: [{ dia: 'asc' }, { hora_inicio: 'asc' }],
    });
  }

  agregarExternos(id_asignatura: number, bloques: BloqueExternoDto[]) {
    return this.prisma.$transaction((tx) =>
      this.crearExternos(tx, id_asignatura, bloques),
    );
  }

  async eliminarExterno(id_asignatura: number, id_bloque_horario: number) {
    const bloque = await this.prisma.bloque_horario.findFirst({
      where: { id_bloque_horario, curso: { id_asignatura } },
    });
    if (!bloque) {
      throw new NotFoundException('Bloque no encontrado para esta asignatura');
    }
    await this.prisma.bloque_horario.delete({ where: { id_bloque_horario } });
    return { mensaje: 'Bloque eliminado correctamente.' };
  }

  private validarForma(bloques: BloqueExternoDto[]) {
    for (const b of bloques) {
      if (b.hora_fin <= b.hora_inicio) {
        throw new BadRequestException(
          `hora_fin debe ser posterior a hora_inicio (${rango(b)})`,
        );
      }
      if ((b.id_sala == null) === (b.sala_externa == null)) {
        throw new BadRequestException(
          `Cada bloque debe indicar id_sala (sala del departamento) o sala_externa, pero no ambos (${rango(b)})`,
        );
      }
    }

    bloques.forEach((a, i) =>
      bloques.slice(i + 1).forEach((b) => {
        if (a.dia === b.dia && seSuperponen(a, b)) {
          throw new BadRequestException(
            `Los bloques enviados se superponen entre sí (${rango(a)} y ${rango(b)})`,
          );
        }
      }),
    );
  }

  private async validarSalas(tx: Tx, bloques: BloqueExternoDto[]) {
    const ids = [
      ...new Set(
        bloques.map((b) => b.id_sala).filter((id): id is number => id != null),
      ),
    ];
    if (ids.length === 0) return;

    const salas = await tx.sala.findMany({ where: { id_sala: { in: ids } } });
    for (const id of ids) {
      const sala = salas.find((s) => s.id_sala === id);
      if (!sala) throw new NotFoundException(`Sala ${id} no encontrada`);
      if (!sala.activo) {
        throw new BadRequestException(`La ${sala.nombre} está desactivada`);
      }
    }
  }

  // Choque de sala con cualquier otro bloque, o del mismo curso consigo mismo
  private async validarChoques(
    tx: Tx,
    bloques: BloqueExternoDto[],
    id_curso: number,
  ) {
    for (const b of bloques) {
      const or: Prisma.Bloque_horarioWhereInput[] = [{ id_curso }];
      if (b.id_sala != null) or.push({ id_sala: b.id_sala });

      const choque = await tx.bloque_horario.findFirst({
        where: {
          dia: b.dia,
          hora_inicio: { lt: b.hora_fin },
          hora_fin: { gt: b.hora_inicio },
          OR: or,
        },
        include: { sala: true, curso: true },
      });
      if (!choque) continue;

      throw new ConflictException(
        choque.id_curso === id_curso
          ? `La asignatura ya tiene un bloque que se superpone con ${rango(b)}`
          : `La ${choque.sala?.nombre} ya está ocupada por "${choque.curso.nombre}" el ${choque.dia} de ${choque.hora_inicio} a ${choque.hora_fin}`,
      );
    }
  }
}
