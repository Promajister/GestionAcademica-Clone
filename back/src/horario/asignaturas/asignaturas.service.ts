import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoCurso, TipoOrigen } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { CreateAsignaturaDto } from './dto/create-asignatura.dto';
import { UpdateAsignaturaDto } from './dto/update-asignatura.dto';
import { QueryAsignaturaDto } from './dto/query-asignatura.dto';
import { BloquesService } from '../bloques/bloques.service';

const CODIGO_DUPLICADO =
  'Ya existe una asignatura registrada con ese código en el plan o con datos distintos.';

const INCLUDE_ASIGNATURA = {
  mallas: {
    include: {
      plan: {
        include: {
          carrera: true,
        },
      },
    },
  },
  cursos: {
    include: {
      horariosExternos: {
        include: {
          sala: true,
          dia: true,
          bloque: true,
        },
      },
    },
  },
} satisfies Prisma.AsignaturaInclude;

type AsignaturaConRelaciones = Prisma.AsignaturaGetPayload<{
  include: typeof INCLUDE_ASIGNATURA;
}>;

function normalizarOrigen(origen: string): TipoOrigen {
  const norm = String(origen).toUpperCase();
  if (norm === 'PROPIA' || norm === 'INTERNA') return TipoOrigen.INTERNA;
  return TipoOrigen.EXTERNA;
}

@Injectable()
export class AsignaturasService {
  constructor(
    private prisma: PrismaService,
    private bloques: BloquesService,
  ) {}

  private assertBloquesSoloExternas(origen: TipoOrigen, bloques?: unknown[]) {
    if (origen !== TipoOrigen.EXTERNA && bloques?.length) {
      throw new BadRequestException(
        'Solo las asignaturas externas permiten fijar bloques bloqueados.',
      );
    }
  }

  // ---------- CREATE ----------
  async create(dto: CreateAsignaturaDto) {
    const origen = normalizarOrigen(dto.origen);
    this.assertBloquesSoloExternas(origen, dto.bloques_externos);

    const plan = await this.prisma.plan.findUnique({
      where: { id_plan: dto.id_plan },
    });
    if (!plan) {
      throw new NotFoundException(`El plan ${dto.id_plan} no existe`);
    }

    const catedra = dto.catedraSemanal ?? dto.bloques_semanales ?? 4;
    const taller = dto.tallerSemanal ?? 0;
    const lab = dto.labSemanal ?? 0;
    const inscritos = dto.cupo ?? 22;

    const existente = await this.prisma.asignatura.findUnique({
      where: { codigo: dto.codigo },
      include: {
        mallas: true,
        cursos: true,
      },
    });

    if (existente) {
      const datosCoinciden =
        existente.nombre.trim().toLowerCase() ===
          dto.nombre.trim().toLowerCase() &&
        existente.origen === origen &&
        existente.catedraSemanal === catedra &&
        existente.tallerSemanal === taller &&
        existente.labSemanal === lab;

      if (!datosCoinciden) {
        throw new ConflictException(CODIGO_DUPLICADO);
      }

      const enMismoPlan = existente.mallas.some(
        (m) => m.id_plan === dto.id_plan,
      );
      if (enMismoPlan) {
        throw new ConflictException(CODIGO_DUPLICADO);
      }

      // Se agrega la asignatura existente a un nuevo plan mediante una nueva Malla
      await this.prisma.$transaction(async (tx) => {
        const nuevaMalla = await tx.malla.create({
          data: {
            id_plan: dto.id_plan,
            semestre: dto.semestre,
            codigo_asignatura: dto.codigo,
          },
        });

        // Crear curso para esta malla si no existe
        const curso = await tx.curso.create({
          data: {
            tipo: TipoCurso.CATEDRA,
            grupo: 'A',
            inscritos,
            year: 2026,
            semestre: dto.semestre,
            codigo_asignatura: dto.codigo,
            id_malla: nuevaMalla.id_malla,
          },
        });

        if (origen === TipoOrigen.EXTERNA && dto.bloques_externos?.length) {
          await this.bloques.crearExternos(
            tx,
            curso.id_curso,
            dto.bloques_externos,
          );
        }
      });

      return this.findOne(dto.codigo);
    }

    // Si la asignatura no existe, se crea completa
    await this.prisma.$transaction(async (tx) => {
      await tx.asignatura.create({
        data: {
          codigo: dto.codigo,
          nombre: dto.nombre,
          catedraSemanal: catedra,
          tallerSemanal: taller,
          labSemanal: lab,
          origen,
        },
      });

      const malla = await tx.malla.create({
        data: {
          id_plan: dto.id_plan,
          semestre: dto.semestre,
          codigo_asignatura: dto.codigo,
        },
      });

      const curso = await tx.curso.create({
        data: {
          tipo: TipoCurso.CATEDRA,
          grupo: 'A',
          inscritos,
          year: 2026,
          semestre: dto.semestre,
          codigo_asignatura: dto.codigo,
          id_malla: malla.id_malla,
        },
      });

      if (origen === TipoOrigen.EXTERNA && dto.bloques_externos?.length) {
        await this.bloques.crearExternos(
          tx,
          curso.id_curso,
          dto.bloques_externos,
        );
      }
    });

    return this.findOne(dto.codigo);
  }

  // ---------- FIND ALL ----------
  async findAll(q: QueryAsignaturaDto) {
    const where: Prisma.AsignaturaWhereInput = {};

    if (q.origen) {
      where.origen = normalizarOrigen(q.origen);
    }

    const mallaConditions: Prisma.MallaWhereInput = {};
    if (q.id_plan) {
      mallaConditions.id_plan = Number(q.id_plan);
    }
    if (q.semestre) {
      mallaConditions.semestre = Number(q.semestre);
    }
    const codCarrera = q.codigo_carrera || q.id_carrera;
    if (codCarrera) {
      mallaConditions.plan = { codigo_carrera: String(codCarrera) };
    }

    if (Object.keys(mallaConditions).length > 0) {
      where.mallas = { some: mallaConditions };
    }

    const asignaturas = await this.prisma.asignatura.findMany({
      where,
      include: INCLUDE_ASIGNATURA,
      orderBy: { codigo: 'asc' },
    });

    return asignaturas.map((a) => this.formatearAsignatura(a, q.id_plan));
  }

  // ---------- FIND ONE ----------
  async findOne(codigo: string) {
    const a = await this.prisma.asignatura.findUnique({
      where: { codigo },
      include: INCLUDE_ASIGNATURA,
    });

    if (!a) {
      throw new NotFoundException(
        `Asignatura con código ${codigo} no encontrada`,
      );
    }

    return this.formatearAsignatura(a);
  }

  // ---------- UPDATE ----------
  async update(codigo: string, dto: UpdateAsignaturaDto) {
    const actual = await this.findOne(codigo);

    const origen =
      dto.origen !== undefined
        ? normalizarOrigen(dto.origen)
        : normalizarOrigen(actual.origen);
    this.assertBloquesSoloExternas(origen, dto.bloques_externos);

    if (dto.id_plan !== undefined && dto.id_plan !== actual.id_plan) {
      const plan = await this.prisma.plan.findUnique({
        where: { id_plan: dto.id_plan },
      });
      if (!plan)
        throw new NotFoundException(`El plan ${dto.id_plan} no existe`);
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Actualizar Asignatura
      const dataAsig: Prisma.AsignaturaUpdateInput = {};
      if (dto.nombre !== undefined) dataAsig.nombre = dto.nombre;
      if (dto.catedraSemanal !== undefined)
        dataAsig.catedraSemanal = dto.catedraSemanal;
      else if (dto.bloques_semanales !== undefined)
        dataAsig.catedraSemanal = dto.bloques_semanales;
      if (dto.tallerSemanal !== undefined)
        dataAsig.tallerSemanal = dto.tallerSemanal;
      if (dto.labSemanal !== undefined) dataAsig.labSemanal = dto.labSemanal;
      if (dto.origen !== undefined) dataAsig.origen = origen;

      if (Object.keys(dataAsig).length > 0) {
        await tx.asignatura.update({
          where: { codigo },
          data: dataAsig,
        });
      }

      // 2. Actualizar Malla
      const malla = await tx.malla.findFirst({
        where: {
          codigo_asignatura: codigo,
          ...(actual.id_plan && { id_plan: actual.id_plan }),
        },
      });

      if (malla && (dto.id_plan !== undefined || dto.semestre !== undefined)) {
        await tx.malla.update({
          where: { id_malla: malla.id_malla },
          data: {
            ...(dto.id_plan !== undefined && { id_plan: dto.id_plan }),
            ...(dto.semestre !== undefined && { semestre: dto.semestre }),
          },
        });
      }

      // 3. Actualizar Curso por defecto
      let curso = await tx.curso.findFirst({
        where: { codigo_asignatura: codigo },
        orderBy: { id_curso: 'asc' },
      });

      if (curso) {
        if (dto.cupo !== undefined || dto.semestre !== undefined) {
          curso = await tx.curso.update({
            where: { id_curso: curso.id_curso },
            data: {
              ...(dto.cupo !== undefined && { inscritos: dto.cupo }),
              ...(dto.semestre !== undefined && { semestre: dto.semestre }),
            },
          });
        }
      }

      // 4. Actualizar Bloques Externos
      if (dto.bloques_externos !== undefined && curso) {
        await this.bloques.crearExternos(
          tx,
          curso.id_curso,
          dto.bloques_externos,
          {
            reemplazar: true,
          },
        );
      }
    });

    return this.findOne(codigo);
  }

  // ---------- DELETE ----------
  async remove(codigo: string) {
    const actual = await this.prisma.asignatura.findUnique({
      where: { codigo },
      include: {
        cursos: {
          include: {
            cargaDocentes: true,
            horariosExternos: true,
          },
        },
      },
    });

    if (!actual) {
      throw new NotFoundException(
        `Asignatura con código ${codigo} no encontrada`,
      );
    }

    const tieneCarga = actual.cursos.some((c) => c.cargaDocentes.length > 0);
    if (tieneCarga) {
      throw new ConflictException(
        'No se puede eliminar la asignatura porque tiene carga docente asignada.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Eliminar horarios externos de los cursos
      for (const curso of actual.cursos) {
        await tx.horarioExterno.deleteMany({
          where: { id_curso: curso.id_curso },
        });
      }
      // Eliminar cursos
      await tx.curso.deleteMany({ where: { codigo_asignatura: codigo } });
      // Eliminar mallas
      await tx.malla.deleteMany({ where: { codigo_asignatura: codigo } });
      // Eliminar asignatura
      await tx.asignatura.delete({ where: { codigo } });
    });

    return { mensaje: 'Asignatura eliminada correctamente.' };
  }

  private formatearAsignatura(
    a: AsignaturaConRelaciones,
    filtroPlanId?: number,
  ) {
    const malla =
      (filtroPlanId
        ? a.mallas.find((m) => m.id_plan === Number(filtroPlanId))
        : null) || a.mallas[0];

    const curso = a.cursos?.[0];
    const bloquesHorarios = (curso?.horariosExternos || []).map((he) => ({
      id_bloque_horario: he.id,
      id: he.id,
      dia: he.dia.nombre,
      bloque_numero: he.id_bloque,
      hora_inicio: he.bloque.horaInicio,
      hora_fin: he.bloque.horaFin,
      id_sala: he.id_sala,
      sala_externa: he.sala_externa,
      sala: he.sala,
      bloqueado: true,
      origen: 'EXTERNA',
    }));

    return {
      id_asignatura: a.codigo,
      codigo: a.codigo,
      nombre: a.nombre,
      catedraSemanal: a.catedraSemanal,
      tallerSemanal: a.tallerSemanal,
      labSemanal: a.labSemanal,
      bloques_semanales: a.catedraSemanal + a.tallerSemanal + a.labSemanal,
      origen: a.origen,
      cupo: curso?.inscritos ?? 22,
      id_plan: malla?.id_plan ?? null,
      semestre: malla?.semestre ?? null,
      plan: malla?.plan
        ? {
            id_plan: malla.plan.id_plan,
            year: malla.plan.year,
            version: malla.plan.version,
            codigo_carrera: malla.plan.codigo_carrera,
            id_carrera: malla.plan.codigo_carrera,
            nombre: `Plan ${malla.plan.year} v${malla.plan.version}`,
            carrera: malla.plan.carrera,
          }
        : null,
      mallas: a.mallas.map((m) => ({
        id_malla: m.id_malla,
        id_plan: m.id_plan,
        semestre: m.semestre,
        plan: {
          id_plan: m.plan.id_plan,
          year: m.plan.year,
          version: m.plan.version,
          codigo_carrera: m.plan.codigo_carrera,
          id_carrera: m.plan.codigo_carrera,
          nombre: `Plan ${m.plan.year} v${m.plan.version}`,
        },
      })),
      cursos: a.cursos.map((c) => ({
        id_curso: c.id_curso,
        tipo: c.tipo,
        grupo: c.grupo,
        inscritos: c.inscritos,
        year: c.year,
        semestre: c.semestre,
        bloques_horarios: bloquesHorarios,
      })),
    };
  }
}
