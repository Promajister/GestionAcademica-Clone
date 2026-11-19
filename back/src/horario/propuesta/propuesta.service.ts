import { ConflictException, Injectable } from '@nestjs/common';
import {
  EstadoHorario,
  Prisma,
  TipoCurso,
  TipoOrigen,
  TipoSala,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

import {
  CursoEntrada,
  DIAS_HABILES,
  NoAsignada,
  generarPropuesta,
} from './generador';
import { Actividad, BloqueActividad, agruparActividades } from './actividades';
import { crucesDeDocente, crucesDeSala } from './validador';

type Db = Prisma.TransactionClient | PrismaService;

const INCLUDE_CURSO = {
  asignatura: true,
  malla: { include: { plan: true } },
} satisfies Prisma.CursoInclude;

type CursoConMalla = Prisma.CursoGetPayload<{ include: typeof INCLUDE_CURSO }>;

// Periodo 1: niveles impares; periodo 2: niveles pares (semestre de la malla)
export const nivelEnPeriodo = (nivel: number, periodo: number) =>
  nivel % 2 === periodo % 2;

const nivelDe = (c: CursoConMalla) => c.malla?.semestre ?? c.semestre;
const cohorteDe = (c: CursoConMalla) =>
  c.malla ? `${c.malla.id_plan}-${c.malla.semestre}` : null;

@Injectable()
export class PropuestaService {
  constructor(private prisma: PrismaService) {}

  async estado(year: number, periodo: number, db: Db = this.prisma) {
    const fila = await db.periodoHorario.findUnique({
      where: { year_periodo: { year, periodo } },
    });
    return {
      year,
      periodo,
      estado: fila?.estado ?? EstadoHorario.BORRADOR,
      generado_en: fila?.generado_en ?? null,
      cerrado_en: fila?.cerrado_en ?? null,
      no_asignadas: (fila?.no_asignadas as unknown as NoAsignada[]) ?? [],
    };
  }

  async asegurarBorrador(year: number, periodo: number, db: Db = this.prisma) {
    const { estado } = await this.estado(year, periodo, db);
    if (estado === EstadoHorario.CERRADO) {
      throw new ConflictException(
        `El horario ${periodo}/${year} está cerrado; reábralo para modificarlo`,
      );
    }
  }

  // Cursos propios del periodo, con su malla para saber nivel, carrera y cohorte
  private async cursosPropios(year: number, periodo: number, db: Db) {
    const cursos = await db.curso.findMany({
      where: { year, asignatura: { origen: TipoOrigen.INTERNA } },
      include: {
        ...INCLUDE_CURSO,
        cargaDocentes: {
          include: {
            profesor: { include: { usuario: true, disponibilidad: true } },
          },
          orderBy: { id_carga: 'asc' },
        },
      },
      orderBy: { id_curso: 'asc' },
    });
    return cursos.filter((c) => nivelEnPeriodo(nivelDe(c), periodo));
  }

  // ---------- POST /horario/propuesta/generar ----------
  async generar(year: number, periodo: number) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.asegurarBorrador(year, periodo, tx);

        const cursos = await this.cursosPropios(year, periodo, tx);

        // Un curso de cátedra incluye taller y laboratorio si la asignatura no tiene cursos aparte para ellos
        const tiposPorAsignatura = new Map<string, Set<TipoCurso>>();
        for (const c of cursos) {
          const tipos =
            tiposPorAsignatura.get(c.codigo_asignatura) ?? new Set();
          tipos.add(c.tipo);
          tiposPorAsignatura.set(c.codigo_asignatura, tipos);
        }
        const bloquesDe = (c: (typeof cursos)[number]) => {
          const a = c.asignatura;
          if (c.tipo === TipoCurso.TALLER) return a.tallerSemanal;
          if (c.tipo === TipoCurso.LABORATORIO) return a.labSemanal;
          const tipos = tiposPorAsignatura.get(c.codigo_asignatura)!;
          return (
            a.catedraSemanal +
            (tipos.has(TipoCurso.TALLER) ? 0 : a.tallerSemanal) +
            (tipos.has(TipoCurso.LABORATORIO) ? 0 : a.labSemanal)
          );
        };

        const entrada: CursoEntrada[] = cursos.map((c) => ({
          id_curso: c.id_curso,
          codigo: c.codigo_asignatura,
          nombre: c.asignatura.nombre,
          grupo: c.grupo,
          inscritos: c.inscritos,
          bloques: bloquesDe(c),
          nivel: nivelDe(c),
          codigo_carrera: c.malla?.plan.codigo_carrera ?? null,
          cohorte: cohorteDe(c),
          docentes: c.cargaDocentes.map((cd) => ({
            id_carga: cd.id_carga,
            id_usuario: cd.id_usuario,
            nombre: cd.profesor.usuario.nombre,
            contrato: cd.profesor.contrato,
            disponibilidad: new Set(
              cd.profesor.disponibilidad.map(
                (d) => `${d.id_dia}-${d.id_bloque}`,
              ),
            ),
          })),
        }));

        const salas = await tx.sala.findMany({
          where: { activo: true, tipo: TipoSala.CLASES },
        });
        const protegidos = await tx.bloqueProtegido.findMany({
          where: { id_dia: { in: DIAS_HABILES } },
        });
        const externos = (
          await tx.horarioExterno.findMany({
            where: { curso: { year } },
            include: { curso: { include: INCLUDE_CURSO } },
          })
        ).filter((x) => nivelEnPeriodo(nivelDe(x.curso), periodo));

        const resultado = generarPropuesta({
          cursos: entrada,
          salas: salas.map((s) => ({
            id_sala: s.id_sala,
            nombre: s.nombre,
            capacidad: s.capacidad,
          })),
          protegidos,
          externos: externos.map((x) => ({
            id_dia: x.id_dia,
            id_bloque: x.id_bloque,
            id_sala: x.id_sala,
            cohorte: cohorteDe(x.curso),
          })),
        });

        // La nueva propuesta reemplaza las clases propias del periodo
        await tx.horario.deleteMany({
          where: { carga: { id_curso: { in: cursos.map((c) => c.id_curso) } } },
        });

        const cargasPorCurso = new Map(
          cursos.map((c) => [
            c.id_curso,
            c.cargaDocentes.map((cd) => cd.id_carga),
          ]),
        );
        const filas: Prisma.HorarioCreateManyInput[] =
          resultado.sesiones.flatMap((s) =>
            s.bloques.flatMap((b) =>
              (cargasPorCurso.get(s.id_curso) ?? []).map((id_carga) => ({
                id_carga,
                id_sala: s.id_sala,
                id_dia: s.id_dia,
                id_bloque: b,
              })),
            ),
          );
        if (filas.length) await tx.horario.createMany({ data: filas });

        await tx.periodoHorario.upsert({
          where: { year_periodo: { year, periodo } },
          create: {
            year,
            periodo,
            estado: EstadoHorario.BORRADOR,
            generado_en: new Date(),
            no_asignadas:
              resultado.no_asignadas as unknown as Prisma.InputJsonValue,
          },
          update: {
            estado: EstadoHorario.BORRADOR,
            generado_en: new Date(),
            cerrado_en: null,
            no_asignadas:
              resultado.no_asignadas as unknown as Prisma.InputJsonValue,
          },
        });

        const bloquesAsignados = resultado.sesiones.reduce(
          (t, s) => t + s.bloques.length,
          0,
        );
        return {
          mensaje: 'Propuesta de horario generada',
          resumen: {
            cursos: cursos.length,
            cursos_completos: cursos.length - resultado.no_asignadas.length,
            bloques_asignados: bloquesAsignados,
            no_asignadas: resultado.no_asignadas.length,
          },
        };
      },
      { timeout: 30000 },
    );
  }

  // ---------- GET /horario/propuesta ----------
  async obtener(year: number, periodo: number) {
    const [estado, salas, bloques] = await Promise.all([
      this.estado(year, periodo),
      this.prisma.sala.findMany({
        where: { activo: true },
        orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
        select: { id_sala: true, nombre: true, tipo: true, capacidad: true },
      }),
      this.bloquesDelPeriodo(year, periodo),
    ]);
    const actividades = agruparActividades(bloques);
    return {
      ...estado,
      salas,
      actividades,
      validacion: this.validarActividades(actividades),
    };
  }

  // ---------- GET /horario/propuesta/validacion ----------
  // Revalida el horario completo del periodo
  async validar(year: number, periodo: number, db: Db = this.prisma) {
    const actividades = agruparActividades(
      await this.bloquesDelPeriodo(year, periodo, db),
    );
    return this.validarActividades(actividades);
  }

  private validarActividades(actividades: Actividad[]) {
    const cruces_sala = crucesDeSala(actividades);
    const cruces_docente = crucesDeDocente(actividades);
    return {
      cruces_sala,
      cruces_docente,
      puede_cerrar: cruces_sala.length === 0 && cruces_docente.length === 0,
    };
  }

  // ---------- POST /horario/propuesta/cerrar ----------
  // GEN-F03 CA2 y GEN-F04 CA3: el horario no se cierra mientras existan cruces sin resolver
  async cerrar(year: number, periodo: number) {
    return this.prisma.$transaction(async (tx) => {
      const actual = await this.estado(year, periodo, tx);
      if (!actual.generado_en) {
        throw new ConflictException(
          `Aún no se genera la propuesta de horario ${periodo}/${year}`,
        );
      }
      if (actual.estado === EstadoHorario.CERRADO) {
        throw new ConflictException(
          `El horario ${periodo}/${year} ya está cerrado`,
        );
      }
      const v = await this.validar(year, periodo, tx);
      if (!v.puede_cerrar) {
        const pendientes = [
          v.cruces_sala.length && `${v.cruces_sala.length} cruce(s) de sala`,
          v.cruces_docente.length &&
            `${v.cruces_docente.length} cruce(s) de docente`,
        ].filter(Boolean);
        throw new ConflictException({
          message: `No se puede cerrar el horario: hay ${pendientes.join(' y ')} sin resolver`,
          validacion: v,
        });
      }
      await tx.periodoHorario.update({
        where: { year_periodo: { year, periodo } },
        data: { estado: EstadoHorario.CERRADO, cerrado_en: new Date() },
      });
      return { mensaje: `Horario ${periodo}/${year} cerrado` };
    });
  }

  // ---------- POST /horario/propuesta/reabrir ----------
  async reabrir(year: number, periodo: number) {
    const actual = await this.estado(year, periodo);
    if (actual.estado !== EstadoHorario.CERRADO) {
      throw new ConflictException(
        `El horario ${periodo}/${year} no está cerrado`,
      );
    }
    await this.prisma.periodoHorario.update({
      where: { year_periodo: { year, periodo } },
      data: { estado: EstadoHorario.BORRADOR, cerrado_en: null },
    });
    return { mensaje: `Horario ${periodo}/${year} reabierto como borrador` };
  }

  // Todos los bloques ocupados del periodo: clases propias (Horario) y externas (HorarioExterno)
  async bloquesDelPeriodo(
    year: number,
    periodo: number,
    db: Db = this.prisma,
  ): Promise<BloqueActividad[]> {
    const internos = await db.horario.findMany({
      where: { carga: { curso: { year } } },
      include: {
        dia: true,
        sala: true,
        carga: {
          include: {
            curso: { include: INCLUDE_CURSO },
            profesor: { include: { usuario: true } },
          },
        },
      },
    });
    const externos = await db.horarioExterno.findMany({
      where: { curso: { year } },
      include: { dia: true, sala: true, curso: { include: INCLUDE_CURSO } },
    });

    // Varias cargas (docentes) de un curso comparten el mismo bloque: se juntan en uno
    const porBloque = new Map<string, BloqueActividad>();
    for (const h of internos) {
      const curso = h.carga.curso;
      if (!nivelEnPeriodo(nivelDe(curso), periodo)) continue;
      const k = `${curso.id_curso}-${h.id_dia}-${h.id_bloque}-${h.id_sala}`;
      const docente = {
        id_usuario: h.carga.id_usuario,
        nombre: h.carga.profesor.usuario.nombre,
      };
      const previo = porBloque.get(k);
      if (previo) {
        previo.docentes.push(docente);
        continue;
      }
      porBloque.set(k, {
        origen: 'INTERNA',
        id_curso: curso.id_curso,
        codigo: curso.codigo_asignatura,
        nombre: curso.asignatura.nombre,
        grupo: curso.grupo,
        nivel: nivelDe(curso),
        id_plan: curso.malla?.id_plan ?? null,
        codigo_carrera: curso.malla?.plan.codigo_carrera ?? null,
        id_dia: h.id_dia,
        dia: h.dia.nombre,
        id_bloque: h.id_bloque,
        id_sala: h.id_sala,
        sala: h.sala.nombre,
        sala_externa: null,
        docentes: [docente],
      });
    }

    const bloquesExternos: BloqueActividad[] = externos
      .filter((x) => nivelEnPeriodo(nivelDe(x.curso), periodo))
      .map((x) => ({
        origen: 'EXTERNA',
        id_curso: x.id_curso,
        codigo: x.curso.codigo_asignatura,
        nombre: x.curso.asignatura.nombre,
        grupo: x.curso.grupo,
        nivel: nivelDe(x.curso),
        id_plan: x.curso.malla?.id_plan ?? null,
        codigo_carrera: x.curso.malla?.plan.codigo_carrera ?? null,
        id_dia: x.id_dia,
        dia: x.dia.nombre,
        id_bloque: x.id_bloque,
        id_sala: x.id_sala,
        sala: x.sala?.nombre ?? null,
        sala_externa: x.sala_externa,
        docentes: [],
      }));

    return [...porBloque.values(), ...bloquesExternos];
  }
}
