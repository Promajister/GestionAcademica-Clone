import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrigenAsignatura, Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { CreateAsignaturaDto } from './dto/create-asignatura.dto';
import { UpdateAsignaturaDto } from './dto/update-asignatura.dto';
import { QueryAsignaturaDto } from './dto/query-asignatura.dto';

const CODIGO_DUPLICADO = 'Ya existe una asignatura registrada con ese código.';

const INCLUDE_ASIGNATURA = {
  plan: { include: { carrera: true } },
  cursos: {
    include: {
      bloques_horarios: {
        include: { sala: true },
        orderBy: [{ dia: 'asc' }, { hora_inicio: 'asc' }],
      },
    },
  },
} satisfies Prisma.AsignaturaInclude;

// Tipo del Curso por defecto según el origen de la asignatura
const tipoCurso = (origen: OrigenAsignatura) =>
  origen === OrigenAsignatura.EXTERNA ? 'EXTERNO' : 'REGULAR';

@Injectable()
export class AsignaturasService {
  constructor(private prisma: PrismaService) {}

  private async assertPlanVigente(id_plan: number) {
    const plan = await this.prisma.plan.findUnique({ where: { id_plan } });
    if (!plan) throw new NotFoundException('Plan de estudio no encontrado');
    if (!plan.vigente) {
      throw new BadRequestException('El plan de estudio no está vigente');
    }
  }

  private async assertCodigoLibre(codigo: string, excluirId?: number) {
    const existente = await this.prisma.asignatura.findFirst({
      where: {
        codigo,
        ...(excluirId !== undefined && { NOT: { id_asignatura: excluirId } }),
      },
    });
    if (existente) throw new ConflictException(CODIGO_DUPLICADO);
  }

  // Cubre la carrera entre la validación previa y el insert/update
  private rethrowDuplicado(e: unknown): never {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw new ConflictException(CODIGO_DUPLICADO);
    }
    throw e;
  }

  // ---------- CREATE ----------
  // Crea la asignatura junto a su Curso por defecto, al que se vinculan
  // Carga_Docente y Bloque_horario según el ERD.
  async create(dto: CreateAsignaturaDto) {
    await this.assertPlanVigente(dto.id_plan);
    await this.assertCodigoLibre(dto.codigo);

    try {
      return await this.prisma.asignatura.create({
        data: {
          codigo: dto.codigo,
          nombre: dto.nombre,
          semestre: dto.semestre,
          cupo: dto.cupo,
          bloques_semanales: dto.bloques_semanales,
          origen: dto.origen,
          id_plan: dto.id_plan,
          cursos: {
            create: { nombre: dto.nombre, tipo: tipoCurso(dto.origen) },
          },
        },
        include: INCLUDE_ASIGNATURA,
      });
    } catch (e) {
      this.rethrowDuplicado(e);
    }
  }

  // ---------- FIND ALL ----------
  findAll(q: QueryAsignaturaDto) {
    return this.prisma.asignatura.findMany({
      where: {
        origen: q.origen,
        id_plan: q.id_plan,
        semestre: q.semestre,
        ...(q.id_carrera && { plan: { id_carrera: q.id_carrera } }),
      },
      include: INCLUDE_ASIGNATURA,
      orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
    });
  }

  // ---------- FIND ONE ----------
  async findOne(id: number) {
    const asignatura = await this.prisma.asignatura.findUnique({
      where: { id_asignatura: id },
      include: INCLUDE_ASIGNATURA,
    });
    if (!asignatura) throw new NotFoundException('Asignatura no encontrada');
    return asignatura;
  }

  // ---------- UPDATE ----------
  async update(id: number, dto: UpdateAsignaturaDto) {
    const actual = await this.findOne(id);

    if (dto.id_plan !== undefined && dto.id_plan !== actual.id_plan) {
      await this.assertPlanVigente(dto.id_plan);
    }
    if (dto.codigo !== undefined) {
      await this.assertCodigoLibre(dto.codigo, id);
    }

    const cambiaOrigen =
      dto.origen !== undefined && dto.origen !== actual.origen;
    const tieneBloques = actual.cursos.some(
      (c) => c.bloques_horarios.length > 0,
    );
    // Cambiar el origen alteraría si sus bloques están bloqueados (ADM-F02 CA2)
    if (cambiaOrigen && tieneBloques) {
      throw new ConflictException(
        'No se puede cambiar el origen de una asignatura que ya tiene bloques en el horario.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.asignatura.update({
          where: { id_asignatura: id },
          data: {
            codigo: dto.codigo,
            nombre: dto.nombre,
            semestre: dto.semestre,
            cupo: dto.cupo,
            bloques_semanales: dto.bloques_semanales,
            origen: dto.origen,
            id_plan: dto.id_plan,
          },
        });

        // Mantiene sincronizado el Curso por defecto (mismo nombre que la asignatura)
        if (dto.nombre !== undefined || cambiaOrigen) {
          await tx.curso.updateMany({
            where: { id_asignatura: id, nombre: actual.nombre },
            data: {
              nombre: dto.nombre,
              ...(cambiaOrigen && { tipo: tipoCurso(dto.origen!) }),
            },
          });
        }

        return tx.asignatura.findUniqueOrThrow({
          where: { id_asignatura: id },
          include: INCLUDE_ASIGNATURA,
        });
      });
    } catch (e) {
      this.rethrowDuplicado(e);
    }
  }

  // ---------- DELETE ----------
  // Cursos y bloques se eliminan en cascada
  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.asignatura.delete({ where: { id_asignatura: id } });
    return { mensaje: 'Asignatura eliminada correctamente.' };
  }
}
