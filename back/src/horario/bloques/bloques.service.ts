import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiaSemana, OrigenAsignatura, Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { BloqueExternoDto } from './dto/bloque-externo.dto';
import { QueryBloqueDto } from './dto/query-bloque.dto';
import { bloquePorNumero, mismaJornada, rangoBloques } from '../common/grilla';
import { choqueConOcupaciones } from '../common/choques';

type Tx = Prisma.TransactionClient;

// Un bloque de 45 min de la grilla, ya expandido desde el rango del DTO
type BloqueGrilla = {
  dia: DiaSemana;
  bloque_numero: number;
  id_sala?: number;
  sala_externa?: string;
};

const describir = (b: BloqueExternoDto) =>
  `${b.dia} bloques ${b.bloque_inicio}-${b.bloque_fin}`;

const describirBloque = (dia: DiaSemana, numero: number) => {
  const { hora_inicio, hora_fin } = bloquePorNumero(numero);
  return `${dia} bloque ${numero} (${hora_inicio}-${hora_fin})`;
};

const ORDEN_GRILLA: Prisma.Bloque_horarioOrderByWithRelationInput[] = [
  { dia: 'asc' },
  { bloque_numero: 'asc' },
];

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
      orderBy: ORDEN_GRILLA,
    });

    return bloques.map((b) => ({ ...b, origen: b.curso.asignatura.origen }));
  }

  // ---------- Registro de bloques de asignaturas EXTERNAS (ADM-F02-T3) ----------
  // Cada rango se guarda como una fila por bloque de 45 min.
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

    const expandidos = this.expandir(bloques);

    if (reemplazar) {
      await tx.bloque_horario.deleteMany({
        where: { id_curso: curso.id_curso },
      });
    }

    await this.validarSalas(tx, expandidos);
    await this.validarChoques(tx, expandidos, curso.id_curso);

    await tx.bloque_horario.createMany({
      data: expandidos.map((b) => ({
        dia: b.dia,
        bloque_numero: b.bloque_numero,
        hora_inicio: bloquePorNumero(b.bloque_numero).hora_inicio,
        hora_fin: bloquePorNumero(b.bloque_numero).hora_fin,
        id_sala: b.id_sala ?? null,
        sala_externa: b.sala_externa ?? null,
        id_curso: curso.id_curso,
        bloqueado: true, // ADM-F02 CA2: los externos nunca se mueven
      })),
    });

    return tx.bloque_horario.findMany({
      where: { id_curso: curso.id_curso },
      include: { sala: true },
      orderBy: ORDEN_GRILLA,
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

  // Valida cada rango y lo convierte en bloques de 45 min
  private expandir(bloques: BloqueExternoDto[]): BloqueGrilla[] {
    const expandidos: BloqueGrilla[] = [];
    const vistos = new Set<string>();

    for (const b of bloques) {
      if (b.bloque_fin < b.bloque_inicio) {
        throw new BadRequestException(
          `bloque_fin no puede ser menor que bloque_inicio (${describir(b)})`,
        );
      }
      if (!mismaJornada(b.bloque_inicio, b.bloque_fin)) {
        throw new BadRequestException(
          `Un rango no puede cruzar la colación entre los bloques 6 y 7 (${describir(b)})`,
        );
      }
      if ((b.id_sala == null) === (b.sala_externa == null)) {
        throw new BadRequestException(
          `Cada bloque debe indicar id_sala (sala del departamento) o sala_externa, pero no ambos (${describir(b)})`,
        );
      }

      for (const numero of rangoBloques(b.bloque_inicio, b.bloque_fin)) {
        const clave = `${b.dia}-${numero}`;
        if (vistos.has(clave)) {
          throw new BadRequestException(
            `Los bloques enviados se superponen entre sí (${describirBloque(b.dia, numero)})`,
          );
        }
        vistos.add(clave);
        expandidos.push({
          dia: b.dia,
          bloque_numero: numero,
          id_sala: b.id_sala ?? undefined,
          sala_externa: b.sala_externa ?? undefined,
        });
      }
    }
    return expandidos;
  }

  private async validarSalas(tx: Tx, bloques: BloqueGrilla[]) {
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

  // Choque de sala con otro bloque o con una ocupación (otra carrera, reserva),
  // o del mismo curso consigo mismo
  private async validarChoques(
    tx: Tx,
    bloques: BloqueGrilla[],
    id_curso: number,
  ) {
    for (const b of bloques) {
      const or: Prisma.Bloque_horarioWhereInput[] = [{ id_curso }];
      if (b.id_sala != null) or.push({ id_sala: b.id_sala });

      const choque = await tx.bloque_horario.findFirst({
        where: { dia: b.dia, bloque_numero: b.bloque_numero, OR: or },
        include: { sala: true, curso: true },
      });
      if (choque) {
        const cuando = describirBloque(b.dia, b.bloque_numero);
        throw new ConflictException(
          choque.id_curso === id_curso
            ? `La asignatura ya tiene clase el ${cuando}`
            : `La ${choque.sala?.nombre} ya está ocupada por "${choque.curso.nombre}" el ${cuando}`,
        );
      }

      if (b.id_sala != null) {
        const ocupada = await choqueConOcupaciones(tx, {
          id_sala: b.id_sala,
          dia: b.dia,
          inicio: b.bloque_numero,
          fin: b.bloque_numero,
        });
        if (ocupada) throw new ConflictException(ocupada);
      }
    }
  }
}
