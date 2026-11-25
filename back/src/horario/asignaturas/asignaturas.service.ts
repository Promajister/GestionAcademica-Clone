import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoCurso, TipoOrigen } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { CreateAsignaturaDto, GrupoDto } from './dto/create-asignatura.dto';
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
      _count: { select: { cargaDocentes: true } },
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
    const grupos = this.gruposDe(dto, origen);

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

      let advertenciasExternas: string[] = [];
      await this.prisma.$transaction(async (tx) => {
        const nuevaMalla = await tx.malla.create({
          data: {
            id_plan: dto.id_plan,
            semestre: dto.semestre,
            codigo_asignatura: dto.codigo,
          },
        });

        // Un curso por grupo; los bloques fijos de una externa van en el primero
        const curso = await this.crearGrupos(tx, grupos, {
          codigo: dto.codigo,
          semestre: dto.semestre,
          id_malla: nuevaMalla.id_malla,
        });

        if (origen === TipoOrigen.EXTERNA && dto.bloques_externos?.length) {
          const resExt = await this.bloques.crearExternos(
            tx,
            curso.id_curso,
            dto.bloques_externos,
          );
          if (resExt.advertencias && resExt.advertencias.length > 0) {
            advertenciasExternas = resExt.advertencias;
          }
        }
      });

      const asig = await this.findOne(dto.codigo);
      if (advertenciasExternas.length > 0) {
        (asig as { advertencias?: string[] }).advertencias =
          advertenciasExternas;
      }
      return asig;
    }

    // Si la asignatura no existe, se crea completa
    let advertencias: string[] = [];
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

      // Un curso por grupo; los bloques fijos de una externa van en el primero
      const curso = await this.crearGrupos(tx, grupos, {
        codigo: dto.codigo,
        semestre: dto.semestre,
        id_malla: malla.id_malla,
      });

      if (origen === TipoOrigen.EXTERNA && dto.bloques_externos?.length) {
        const resExt = await this.bloques.crearExternos(
          tx,
          curso.id_curso,
          dto.bloques_externos,
        );
        if (resExt.advertencias?.length) {
          advertencias = resExt.advertencias;
        }
      }
    });

    const resultado = await this.findOne(dto.codigo);
    if (advertencias.length > 0) {
      (resultado as { advertencias?: string[] }).advertencias = advertencias;
    }
    return resultado;
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

      // 3. Actualizar los cursos de la malla: uno por grupo
      const cursosMalla = await tx.curso.findMany({
        where: {
          codigo_asignatura: codigo,
          tipo: TipoCurso.CATEDRA,
          ...(malla && {
            OR: [{ id_malla: malla.id_malla }, { id_malla: null }],
          }),
        },
        include: { _count: { select: { cargaDocentes: true } } },
        orderBy: { id_curso: 'asc' },
      });
      if (dto.grupos !== undefined) {
        await this.sincronizarGrupos(
          tx,
          cursosMalla,
          this.gruposDe(dto, origen),
          {
            codigo,
            semestre:
              dto.semestre ?? actual.semestre ?? cursosMalla[0]?.semestre ?? 1,
            id_malla: malla?.id_malla ?? null,
          },
        );
      } else if (dto.cupo !== undefined && cursosMalla[0]) {
        await tx.curso.update({
          where: { id_curso: cursosMalla[0].id_curso },
          data: { inscritos: dto.cupo },
        });
      }
      // El semestre se actualiza en todos los grupos, no solo en el primero
      if (dto.semestre !== undefined && cursosMalla.length) {
        await tx.curso.updateMany({
          where: { id_curso: { in: cursosMalla.map((c) => c.id_curso) } },
          data: { semestre: dto.semestre },
        });
      }
      const curso = await tx.curso.findFirst({
        where: { codigo_asignatura: codigo },
        orderBy: { id_curso: 'asc' },
      });

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

  // Grupos pedidos, o un solo grupo A con el cupo indicado
  private gruposDe(
    dto: { grupos?: GrupoDto[]; cupo?: number },
    origen: TipoOrigen,
  ): GrupoDto[] {
    const grupos = dto.grupos?.length
      ? dto.grupos
      : [{ grupo: 'A', cupo: dto.cupo ?? 22 }];
    if (new Set(grupos.map((g) => g.grupo)).size !== grupos.length) {
      throw new BadRequestException('Hay grupos repetidos');
    }
    if (origen === TipoOrigen.EXTERNA && grupos.length > 1) {
      throw new BadRequestException(
        'Las asignaturas externas tienen un solo grupo: sus bloques son fijos',
      );
    }
    return [...grupos].sort((a, b) => a.grupo.localeCompare(b.grupo));
  }

  private async crearGrupos(
    tx: Prisma.TransactionClient,
    grupos: GrupoDto[],
    datos: { codigo: string; semestre: number; id_malla: number },
  ) {
    const cursos: Prisma.CursoGetPayload<object>[] = [];
    for (const g of grupos) {
      cursos.push(
        await tx.curso.create({
          data: {
            tipo: TipoCurso.CATEDRA,
            grupo: g.grupo,
            inscritos: g.cupo,
            year: 2026,
            semestre: datos.semestre,
            codigo_asignatura: datos.codigo,
            id_malla: datos.id_malla,
          },
        }),
      );
    }
    return cursos[0];
  }

  // Deja los cursos de la malla iguales a los grupos pedidos. Un grupo con docente asignado
  // no se elimina: primero se quita su carga en Carga docente
  private async sincronizarGrupos(
    tx: Prisma.TransactionClient,
    cursos: {
      id_curso: number;
      grupo: string;
      inscritos: number;
      _count: { cargaDocentes: number };
    }[],
    grupos: GrupoDto[],
    datos: { codigo: string; semestre: number; id_malla: number | null },
  ) {
    for (const c of cursos) {
      if (grupos.some((g) => g.grupo === c.grupo)) continue;
      if (c._count.cargaDocentes > 0) {
        throw new ConflictException(
          `El grupo ${c.grupo} tiene docente asignado en Carga docente; quítalo allí antes de eliminar el grupo`,
        );
      }
      await tx.curso.delete({ where: { id_curso: c.id_curso } });
    }
    for (const g of grupos) {
      const c = cursos.find((x) => x.grupo === g.grupo);
      if (c) {
        if (c.inscritos !== g.cupo) {
          await tx.curso.update({
            where: { id_curso: c.id_curso },
            data: { inscritos: g.cupo },
          });
        }
        continue;
      }
      await tx.curso.create({
        data: {
          tipo: TipoCurso.CATEDRA,
          grupo: g.grupo,
          inscritos: g.cupo,
          year: 2026,
          semestre: datos.semestre,
          codigo_asignatura: datos.codigo,
          id_malla: datos.id_malla,
        },
      });
    }
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
      // Grupos (cursos de cátedra) de la malla mostrada
      grupos: a.cursos
        .filter(
          (c) =>
            c.tipo === TipoCurso.CATEDRA &&
            (!malla || c.id_malla == null || c.id_malla === malla.id_malla),
        )
        .sort((x, y) => x.grupo.localeCompare(y.grupo))
        .map((c) => ({
          id_curso: c.id_curso,
          grupo: c.grupo,
          cupo: c.inscritos,
          con_carga: c._count.cargaDocentes > 0,
        })),
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
