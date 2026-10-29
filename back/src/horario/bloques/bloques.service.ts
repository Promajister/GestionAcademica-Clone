import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoDia, TipoOrigen } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { BloqueExternoDto } from './dto/bloque-externo.dto';
import { QueryBloqueDto } from './dto/query-bloque.dto';
import { bloquePorNumero, mismaJornada, rangoBloques } from '../common/grilla';
import { choqueConOcupaciones } from '../common/choques';

type Tx = Prisma.TransactionClient;

type BloqueGrilla = {
  dia: string;
  id_dia: number;
  bloque_numero: number;
  id_sala?: number;
  sala_externa?: string;
};

const describir = (b: BloqueExternoDto) =>
  `${b.dia} bloques ${b.bloque_inicio}-${b.bloque_fin}`;

const describirBloque = (dia: string, numero: number) => {
  const { hora_inicio, hora_fin } = bloquePorNumero(numero);
  return `${dia} bloque ${numero} (${hora_inicio}-${hora_fin})`;
};

@Injectable()
export class BloquesService {
  constructor(private prisma: PrismaService) {}

  // ---------- GET /horario/bloques ----------
  // Devuelve los bloques ocupados en la grilla horaria
  async findAll(q: QueryBloqueDto) {
    const diaWhere = q.dia ? { dia: { nombre: q.dia } } : {};
    const salaWhere = q.id_sala ? { id_sala: q.id_sala } : {};

    // 1. Bloques de asignaturas externas
    const externos = await this.prisma.horarioExterno.findMany({
      where: {
        ...diaWhere,
        ...salaWhere,
      },
      include: {
        sala: true,
        dia: true,
        bloque: true,
        curso: {
          include: {
            asignatura: true,
          },
        },
      },
      orderBy: [{ id_dia: 'asc' }, { id_bloque: 'asc' }],
    });

    // 2. Bloques de asignaturas internas
    const internos = await this.prisma.horario.findMany({
      where: {
        ...diaWhere,
        ...salaWhere,
      },
      include: {
        sala: true,
        dia: true,
        bloque: true,
        carga: {
          include: {
            curso: {
              include: {
                asignatura: true,
              },
            },
          },
        },
      },
      orderBy: [{ id_dia: 'asc' }, { id_bloque: 'asc' }],
    });

    const resultadoExternos = externos.map((b) => ({
      id_bloque_horario: b.id,
      id: b.id,
      dia: b.dia.nombre,
      bloque_numero: b.id_bloque,
      hora_inicio: b.bloque.horaInicio,
      hora_fin: b.bloque.horaFin,
      id_sala: b.id_sala,
      sala_externa: b.sala_externa,
      sala: b.sala,
      bloqueado: true,
      origen: 'EXTERNA',
      curso: {
        id_curso: b.curso.id_curso,
        nombre: b.curso.asignatura.nombre,
        grupo: b.curso.grupo,
        semestre: b.curso.semestre,
        asignatura: {
          codigo: b.curso.asignatura.codigo,
          nombre: b.curso.asignatura.nombre,
          semestre: b.curso.semestre,
          origen: b.curso.asignatura.origen,
        },
      },
    }));

    const resultadoInternos = internos.map((b) => ({
      id_bloque_horario: b.id_bloque,
      id: b.id_bloque,
      dia: b.dia.nombre,
      bloque_numero: b.id_bloque,
      hora_inicio: b.bloque.horaInicio,
      hora_fin: b.bloque.horaFin,
      id_sala: b.id_sala,
      sala_externa: null,
      sala: b.sala,
      bloqueado: false,
      origen: 'INTERNA',
      curso: {
        id_curso: b.carga.curso.id_curso,
        nombre: b.carga.curso.asignatura.nombre,
        grupo: b.carga.curso.grupo,
        semestre: b.carga.curso.semestre,
        asignatura: {
          codigo: b.carga.curso.asignatura.codigo,
          nombre: b.carga.curso.asignatura.nombre,
          semestre: b.carga.curso.semestre,
          origen: b.carga.curso.asignatura.origen,
        },
      },
    }));

    let todos = [...resultadoExternos, ...resultadoInternos];

    if (q.origen) {
      const origNorm = q.origen.toUpperCase();
      todos = todos.filter((b) =>
        origNorm === 'PROPIA' ? b.origen === 'INTERNA' : b.origen === origNorm,
      );
    }

    return todos;
  }

  // ---------- Registro de bloques de asignaturas EXTERNAS (ADM-F02-T3) ----------
  async crearExternos(
    tx: Tx,
    id_curso: number,
    bloques: BloqueExternoDto[],
    { reemplazar = false } = {},
  ) {
    const curso = await tx.curso.findUnique({
      where: { id_curso },
      include: { asignatura: true },
    });
    if (!curso) {
      throw new NotFoundException('Curso no encontrado');
    }
    if (curso.asignatura.origen !== TipoOrigen.EXTERNA) {
      throw new BadRequestException(
        'Solo las asignaturas externas permiten fijar bloques bloqueados manualmente en este mantenedor.',
      );
    }

    const expandidos = await this.expandir(tx, bloques);

    if (reemplazar) {
      await tx.horarioExterno.deleteMany({
        where: { id_curso },
      });
    } else {
      const existentes = await tx.horarioExterno.findMany({
        where: { id_curso },
        include: { dia: true },
      });
      for (const b of expandidos) {
        const solape = existentes.find(
          (e) => e.id_dia === b.id_dia && e.id_bloque === b.bloque_numero,
        );
        if (solape) {
          throw new ConflictException(
            `La asignatura ya tiene un bloque asignado el ${solape.dia.nombre} bloque ${b.bloque_numero}`,
          );
        }
      }
    }

    await this.validarSalas(tx, expandidos);
    await this.validarChoques(tx, expandidos, id_curso);

    await tx.horarioExterno.createMany({
      data: expandidos.map((b) => ({
        id_curso,
        id_dia: b.id_dia,
        id_bloque: b.bloque_numero,
        id_sala: b.id_sala ?? null,
        sala_externa: b.sala_externa ?? null,
      })),
    });

    return tx.horarioExterno.findMany({
      where: { id_curso },
      include: { sala: true, dia: true, bloque: true },
      orderBy: [{ id_dia: 'asc' }, { id_bloque: 'asc' }],
    });
  }

  async agregarExternos(
    codigo_asignatura: string,
    bloques: BloqueExternoDto[],
  ) {
    const curso = await this.prisma.curso.findFirst({
      where: { codigo_asignatura },
      orderBy: { id_curso: 'asc' },
    });
    if (!curso) {
      throw new NotFoundException('La asignatura no tiene un curso asociado');
    }
    return this.prisma.$transaction((tx) =>
      this.crearExternos(tx, curso.id_curso, bloques),
    );
  }

  async eliminarExterno(codigo_asignatura: string, idBloqueExterno: number) {
    const bloque = await this.prisma.horarioExterno.findFirst({
      where: {
        id: idBloqueExterno,
        curso: { codigo_asignatura },
      },
    });
    if (!bloque) {
      throw new NotFoundException('Bloque no encontrado para esta asignatura');
    }
    await this.prisma.horarioExterno.delete({
      where: { id: idBloqueExterno },
    });
    return { mensaje: 'Bloque eliminado correctamente.' };
  }

  // Valida cada rango y lo convierte en bloques de 45 min
  private async expandir(
    tx: Tx,
    bloques: BloqueExternoDto[],
  ): Promise<BloqueGrilla[]> {
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

      const diaRegistro = await tx.dia.findFirst({
        where: { nombre: b.dia as TipoDia },
      });
      if (!diaRegistro) {
        throw new BadRequestException(`Día no válido: ${b.dia}`);
      }

      for (const numero of rangoBloques(b.bloque_inicio, b.bloque_fin)) {
        const clave = `${diaRegistro.id_dia}-${numero}`;
        if (vistos.has(clave)) {
          throw new BadRequestException(
            `Los bloques enviados se superponen entre sí (${describirBloque(b.dia, numero)})`,
          );
        }
        vistos.add(clave);
        expandidos.push({
          dia: b.dia,
          id_dia: diaRegistro.id_dia,
          bloque_numero: numero,
          id_sala: b.id_sala ?? undefined,
          sala_externa: b.sala_externa ?? undefined,
        });
      }
    }

    return expandidos;
  }

  private async validarSalas(tx: Tx, bloques: BloqueGrilla[]) {
    const salasId = [
      ...new Set(
        bloques.map((b) => b.id_sala).filter((id): id is number => id != null),
      ),
    ];
    if (salasId.length === 0) return;

    const salas = await tx.sala.findMany({
      where: { id_sala: { in: salasId } },
    });
    const encontradas = new Set(salas.map((s) => s.id_sala));
    for (const id of salasId) {
      if (!encontradas.has(id)) {
        throw new NotFoundException(`La sala con id ${id} no existe`);
      }
      const s = salas.find((sala) => sala.id_sala === id);
      if (s && !s.activo) {
        throw new BadRequestException(`La sala ${s.nombre} está inactiva`);
      }
    }
  }

  private async validarChoques(
    tx: Tx,
    bloques: BloqueGrilla[],
    id_curso: number,
  ) {
    for (const b of bloques) {
      if (b.id_sala == null) continue;

      const choque = await choqueConOcupaciones(tx, {
        id_sala: b.id_sala,
        id_dia: b.id_dia,
        bloque_numero: b.bloque_numero,
        excluirCursoId: id_curso,
      });

      if (choque) {
        throw new ConflictException(choque);
      }
    }
  }
}
