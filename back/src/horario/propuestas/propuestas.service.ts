import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AlcanceBloqueProtegido,
  EstadoHorario,
  Prisma,
  TipoContrato,
  TipoCurso,
  TipoOrigen,
  TipoSala,
} from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { PlanPeriodoDto } from './dto/plan-periodo.dto';
import {
  AdvertenciaCurso,
  CursoAGenerar,
  DIAS_GENERACION,
  DiaGeneracion,
  DocenteGen,
  EntradaGenerador,
  ResultadoCurso,
  SesionGenerada,
  claveBloque,
  claveDocente,
  claveSala,
  generarHorario,
} from './generador';

// ---------- Respuesta (contrato con el front) ----------
export interface CursoPropuesta {
  id_curso: number;
  tipo: TipoCurso;
  grupo: string;
  codigo_asignatura: string;
  nombre_asignatura: string;
  nivel: number;
  bloques_requeridos: number;
  inscritos: number;
  docentes: { id_usuario: number; nombre: string; contrato: TipoContrato }[];
  sesiones: SesionGenerada[];
  estado: ResultadoCurso['estado'];
  motivo: ResultadoCurso['motivo'];
  detalle_motivo: string | null;
  advertencias: AdvertenciaCurso[];
}

export interface PropuestaHorarioResponse {
  id_plan: number;
  codigo_carrera: string;
  periodo: number;
  year: number;
  // BORRADOR si hay cambios sin guardar; si no, PROPUESTA guardada; null si no hay nada
  estado: 'BORRADOR' | 'PROPUESTA' | null;
  // Los motivos solo existen justo después de generar (no se guardan)
  con_motivos: boolean;
  niveles: number[]; // niveles del plan que se dictan en el período
  cursos: CursoPropuesta[];
  resumen: {
    total_cursos: number;
    asignados: number;
    parciales: number;
    no_asignados: number;
    sin_docente: number;
    sin_inscritos: number;
  };
  // Advertencia de la generación: asignaturas propias del período sin cursos
  asignaturas_sin_cursos: { codigo: string; nombre: string; nivel: number }[];
}

// ---------- Consultas reutilizadas ----------
const INCLUDE_CURSO = {
  asignatura: true,
  malla: true,
  cargaDocentes: {
    include: {
      profesor: { include: { usuario: { select: { nombre: true } } } },
    },
  },
} satisfies Prisma.CursoInclude;

type CursoCargado = Prisma.CursoGetPayload<{ include: typeof INCLUDE_CURSO }>;

interface Contexto {
  idPlan: number;
  codigoCarrera: string;
  periodo: number;
  year: number;
  niveles: number[];
  cursos: CursoCargado[]; // cursos propios a planificar
  asignaturasSinCursos: PropuestaHorarioResponse['asignaturas_sin_cursos'];
  diaPorId: Map<number, DiaGeneracion>;
  idPorDia: Map<DiaGeneracion, number>;
}

const ES_DIA_GENERACION = (d: string): d is DiaGeneracion =>
  (DIAS_GENERACION as readonly string[]).includes(d);

// Niveles del período: impares en el primer semestre, pares en el segundo
const nivelEnPeriodo = (nivel: number, periodo: number) =>
  nivel % 2 === (periodo === 1 ? 1 : 0);

// Bloques que pide un curso según su tipo y las horas de la asignatura
const bloquesRequeridos = (c: CursoCargado) =>
  c.tipo === TipoCurso.CATEDRA
    ? c.asignatura.catedraSemanal
    : c.tipo === TipoCurso.TALLER
      ? c.asignatura.tallerSemanal
      : c.asignatura.labSemanal;

const DIAS_ORDEN: Record<DiaGeneracion, number> = {
  LUNES: 1,
  MARTES: 2,
  MIERCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
};

@Injectable()
export class PropuestasService {
  constructor(private readonly prisma: PrismaService) {}

  // El año no se elige: se planifica sobre los cursos del año en curso
  private yearPlanificacion() {
    return new Date().getFullYear();
  }

  // Filtro de los cursos de un plan en un período (para leer/borrar sus filas)
  private filtroCursosPlan(ctx: { idPlan: number; periodo: number; year: number }) {
    return {
      year: ctx.year,
      semestre: ctx.periodo,
      malla: { id_plan: ctx.idPlan },
    } satisfies Prisma.CursoWhereInput;
  }

  // ======================================================================
  // GET /horario/propuestas?id_plan=&periodo=
  // Devuelve el borrador si existe; si no, la propuesta guardada.
  // ======================================================================
  async obtener(dto: PlanPeriodoDto): Promise<PropuestaHorarioResponse> {
    const ctx = await this.cargarContexto(dto);

    for (const estado of [EstadoHorario.BORRADOR, EstadoHorario.PROPUESTA]) {
      const filas = await this.prisma.horario.findMany({
        where: { estado, curso: this.filtroCursosPlan(ctx) },
        include: { sala: true },
      });
      if (filas.length > 0) {
        const resultados = this.resultadosDesdeFilas(ctx, filas);
        return this.armarRespuesta(ctx, resultados, estado, false);
      }
    }
    return this.armarRespuesta(ctx, [], null, false);
  }

  // ======================================================================
  // POST /horario/propuestas/generar  { id_plan, periodo }
  // Calcula la propuesta y la guarda como BORRADOR (reemplaza el anterior).
  // ======================================================================
  async generar(dto: PlanPeriodoDto): Promise<PropuestaHorarioResponse> {
    const ctx = await this.cargarContexto(dto);
    const entrada = await this.armarEntradaGenerador(ctx);
    const resultados = generarHorario(entrada);

    const filas: Prisma.HorarioCreateManyInput[] = [];
    for (const r of resultados) {
      for (const s of r.sesiones) {
        for (let b = s.bloque_inicio; b <= s.bloque_fin; b++) {
          filas.push({
            id_curso: r.id_curso,
            id_sala: s.id_sala,
            id_dia: ctx.idPorDia.get(s.dia)!,
            id_bloque: b,
            estado: EstadoHorario.BORRADOR,
          });
        }
      }
    }

    try {
      await this.prisma.$transaction([
        this.prisma.horario.deleteMany({
          where: {
            estado: EstadoHorario.BORRADOR,
            curso: this.filtroCursosPlan(ctx),
          },
        }),
        this.prisma.horario.createMany({ data: filas }),
      ]);
    } catch (e) {
      this.relanzarSiChoque(e);
      throw e;
    }

    return this.armarRespuesta(ctx, resultados, EstadoHorario.BORRADOR, true);
  }

  // ======================================================================
  // POST /horario/propuestas/guardar  { id_plan, periodo }
  // El borrador pasa a PROPUESTA; la propuesta anterior del plan se elimina.
  // ======================================================================
  async guardar(dto: PlanPeriodoDto): Promise<PropuestaHorarioResponse> {
    const ctx = await this.cargarContexto(dto);
    const filtro = this.filtroCursosPlan(ctx);

    const borrador = await this.prisma.horario.count({
      where: { estado: EstadoHorario.BORRADOR, curso: filtro },
    });
    if (borrador === 0) {
      throw new BadRequestException(
        'No hay un borrador para guardar. Genera una propuesta primero.',
      );
    }

    try {
      await this.prisma.$transaction([
        this.prisma.horario.deleteMany({
          where: { estado: EstadoHorario.PROPUESTA, curso: filtro },
        }),
        this.prisma.horario.updateMany({
          where: { estado: EstadoHorario.BORRADOR, curso: filtro },
          data: { estado: EstadoHorario.PROPUESTA },
        }),
      ]);
    } catch (e) {
      this.relanzarSiChoque(e);
      throw e;
    }

    return this.obtener(dto);
  }

  // ======================================================================
  // DELETE /horario/propuestas?id_plan=&periodo=
  // Elimina el borrador del plan. La propuesta guardada no se toca.
  // ======================================================================
  async descartar(dto: PlanPeriodoDto): Promise<PropuestaHorarioResponse> {
    const ctx = await this.cargarContexto(dto);
    await this.prisma.horario.deleteMany({
      where: { estado: EstadoHorario.BORRADOR, curso: this.filtroCursosPlan(ctx) },
    });
    return this.obtener(dto);
  }

  // ----------------------------------------------------------------------
  // Carga común: plan, niveles del período, cursos propios y días
  // ----------------------------------------------------------------------
  private async cargarContexto(dto: PlanPeriodoDto): Promise<Contexto> {
    const idPlan = Number(dto.id_plan);
    const periodo = Number(dto.periodo);
    const year = this.yearPlanificacion();

    const plan = await this.prisma.plan.findUnique({ where: { id_plan: idPlan } });
    if (!plan) throw new NotFoundException(`El plan ${idPlan} no existe`);

    // Mallas del plan que se dictan en el período (niveles pares o impares)
    const mallas = (
      await this.prisma.malla.findMany({
        where: { id_plan: idPlan },
        include: { asignatura: true },
      })
    ).filter((m) => nivelEnPeriodo(m.semestre, periodo));

    const niveles = [...new Set(mallas.map((m) => m.semestre))].sort(
      (a, b) => a - b,
    );

    // Cursos propios del año y período, de esas mallas
    const cursos = (
      await this.prisma.curso.findMany({
        where: {
          year,
          semestre: periodo,
          id_malla: { in: mallas.map((m) => m.id_malla) },
          asignatura: { origen: TipoOrigen.INTERNA },
        },
        include: INCLUDE_CURSO,
        orderBy: [{ codigo_asignatura: 'asc' }, { tipo: 'asc' }, { grupo: 'asc' }],
      })
    )
      // Un curso cuyo tipo no tiene horas en la asignatura no necesita horario
      .filter((c) => bloquesRequeridos(c) > 0);

    // Asignaturas propias del período sin ningún curso (prácticas, memorias...)
    const conCursos = new Set(cursos.map((c) => c.codigo_asignatura));
    const asignaturasSinCursos = mallas
      .filter(
        (m) =>
          m.asignatura.origen === TipoOrigen.INTERNA &&
          !conCursos.has(m.codigo_asignatura),
      )
      .map((m) => ({
        codigo: m.codigo_asignatura,
        nombre: m.asignatura.nombre,
        nivel: m.semestre,
      }))
      .sort((a, b) => a.nivel - b.nivel || a.codigo.localeCompare(b.codigo));

    // Los id de `dias` no se asumen: se leen de la tabla
    const diaPorId = new Map<number, DiaGeneracion>();
    const idPorDia = new Map<DiaGeneracion, number>();
    for (const d of await this.prisma.dia.findMany()) {
      if (ES_DIA_GENERACION(d.nombre)) {
        diaPorId.set(d.id_dia, d.nombre);
        idPorDia.set(d.nombre, d.id_dia);
      }
    }
    if (idPorDia.size !== DIAS_GENERACION.length) {
      throw new InternalServerErrorException(
        'Faltan días hábiles en la tabla dias (ejecuta el seed)',
      );
    }

    return {
      idPlan,
      codigoCarrera: plan.codigo_carrera,
      periodo,
      year,
      niveles,
      cursos,
      asignaturasSinCursos,
      diaPorId,
      idPorDia,
    };
  }

  // ----------------------------------------------------------------------
  // Arma la entrada del generador: cursos, docentes, salas y ocupaciones fijas
  // ----------------------------------------------------------------------
  private async armarEntradaGenerador(ctx: Contexto): Promise<EntradaGenerador> {
    const { diaPorId } = ctx;
    const nivelesSet = new Set(ctx.niveles);

    // 1. Cursos a generar
    const cursos: CursoAGenerar[] = ctx.cursos.map((c) => ({
      id_curso: c.id_curso,
      tipo: c.tipo,
      grupo: c.grupo,
      codigo_asignatura: c.codigo_asignatura,
      nombre_asignatura: c.asignatura.nombre,
      nivel: c.malla!.semestre,
      bloques_requeridos: bloquesRequeridos(c),
      inscritos: c.inscritos,
      docentes: c.cargaDocentes.map((cd) => cd.id_usuario),
    }));

    // 2. Salas: activas y de clases
    const salas = (
      await this.prisma.sala.findMany({
        where: { activo: true, tipo: TipoSala.CLASES },
      })
    ).map((s) => ({ id_sala: s.id_sala, nombre: s.nombre, capacidad: s.capacidad }));

    const ocupadoPorNivel = new Map<number, Set<string>>();
    const marcarNivel = (nivel: number, k: string) => {
      if (!ocupadoPorNivel.has(nivel)) ocupadoPorNivel.set(nivel, new Set());
      ocupadoPorNivel.get(nivel)!.add(k);
    };
    const salasOcupadas = new Set<string>();
    const docentesOcupados = new Set<string>();

    // 3. Bloques protegidos (se cargan una vez y se evalúan en memoria,
    //    con las mismas reglas de alcance que `choques.ts`)
    const protegidos = await this.prisma.bloqueProtegido.findMany({
      include: { dia: true },
    });
    for (const bp of protegidos) {
      if (!ES_DIA_GENERACION(bp.dia.nombre)) continue;
      const k = claveBloque(bp.dia.nombre, bp.id_bloque);
      for (const nivel of nivelesSet) {
        const aplica =
          bp.alcance === AlcanceBloqueProtegido.UNIVERSIDAD ||
          bp.alcance === AlcanceBloqueProtegido.FACULTAD ||
          (bp.alcance === AlcanceBloqueProtegido.CARRERA &&
            bp.codigo_carrera === ctx.codigoCarrera) ||
          ((bp.alcance === AlcanceBloqueProtegido.ESTUDIANTES ||
            bp.alcance === AlcanceBloqueProtegido.PRACTICA_PREPRACTICA) &&
            bp.codigo_carrera === ctx.codigoCarrera &&
            bp.semestre === nivel);
        if (aplica) marcarNivel(nivel, k);
      }
    }

    // 4. Asignaturas externas: no se generan; sus bloques son fijos.
    //    Ocupan su nivel (si son de este plan) y su sala (de cualquier plan).
    const externos = await this.prisma.horarioExterno.findMany({
      where: { curso: { year: ctx.year, semestre: ctx.periodo } },
      include: { curso: { include: { malla: true } } },
    });
    for (const he of externos) {
      const dia = diaPorId.get(he.id_dia);
      if (!dia) continue;
      if (he.id_sala != null) salasOcupadas.add(claveSala(he.id_sala, dia, he.id_bloque));
      const malla = he.curso.malla;
      if (malla && malla.id_plan === ctx.idPlan && nivelesSet.has(malla.semestre)) {
        marcarNivel(malla.semestre, claveBloque(dia, he.id_bloque));
      }
    }

    // 5. Otros planes (cualquier estado, mismo año y período): sus salas y
    //    docentes quedan ocupados para que dos planes no se pisen.
    const otrosPlanes = await this.prisma.horario.findMany({
      where: {
        curso: {
          year: ctx.year,
          semestre: ctx.periodo,
          NOT: { malla: { id_plan: ctx.idPlan } },
        },
      },
      include: { curso: { include: { cargaDocentes: true } } },
    });
    for (const h of otrosPlanes) {
      const dia = diaPorId.get(h.id_dia);
      if (!dia) continue;
      salasOcupadas.add(claveSala(h.id_sala, dia, h.id_bloque));
      for (const cd of h.curso.cargaDocentes) {
        docentesOcupados.add(claveDocente(cd.id_usuario, dia, h.id_bloque));
      }
    }

    // 6. Docentes de los cursos: contrato, disponibilidad y protegidos propios
    const profesores = new Map<number, CursoCargado['cargaDocentes'][number]['profesor']>();
    for (const c of ctx.cursos) {
      for (const cd of c.cargaDocentes) profesores.set(cd.id_usuario, cd.profesor);
    }
    const ids = [...profesores.keys()];
    const disponibilidades = ids.length
      ? await this.prisma.disponibilidad.findMany({
          where: { id_usuario: { in: ids } },
          include: { dia: true },
        })
      : [];

    const docentes: DocenteGen[] = ids.map((id) => {
      const p = profesores.get(id)!;
      const disponibilidad = new Set(
        disponibilidades
          .filter((d) => d.id_usuario === id && ES_DIA_GENERACION(d.dia.nombre))
          .map((d) => claveBloque(d.dia.nombre, d.id_bloque)),
      );
      const propios = new Set(
        protegidos
          .filter(
            (bp) =>
              ES_DIA_GENERACION(bp.dia.nombre) &&
              ((bp.alcance === AlcanceBloqueProtegido.ACADEMICO_INDIVIDUAL &&
                bp.id_usuario === id) ||
                (bp.alcance === AlcanceBloqueProtegido.ACADEMICOS &&
                  (bp.contrato === null || bp.contrato === p.contrato))),
          )
          .map((bp) => claveBloque(bp.dia.nombre, bp.id_bloque)),
      );
      return {
        id_usuario: id,
        nombre: p.usuario.nombre,
        contrato: p.contrato,
        disponibilidad,
        protegidos: propios,
      };
    });

    return { cursos, docentes, salas, ocupadoPorNivel, salasOcupadas, docentesOcupados };
  }

  // ----------------------------------------------------------------------
  // Reconstruye los resultados desde filas guardadas (sin motivos)
  // ----------------------------------------------------------------------
  private resultadosDesdeFilas(
    ctx: Contexto,
    filas: Prisma.HorarioGetPayload<{ include: { sala: true } }>[],
  ): ResultadoCurso[] {
    const porCurso = new Map<number, typeof filas>();
    for (const f of filas) {
      if (!porCurso.has(f.id_curso)) porCurso.set(f.id_curso, []);
      porCurso.get(f.id_curso)!.push(f);
    }

    return ctx.cursos.map((c) => {
      const propias = (porCurso.get(c.id_curso) ?? [])
        .filter((f) => ctx.diaPorId.has(f.id_dia))
        .sort(
          (a, b) =>
            DIAS_ORDEN[ctx.diaPorId.get(a.id_dia)!] -
              DIAS_ORDEN[ctx.diaPorId.get(b.id_dia)!] || a.id_bloque - b.id_bloque,
        );

      // Bloques consecutivos del mismo día, sala y par -> una sesión
      const sesiones: SesionGenerada[] = [];
      for (const f of propias) {
        const dia = ctx.diaPorId.get(f.id_dia)!;
        const ultima = sesiones[sesiones.length - 1];
        if (
          ultima &&
          ultima.dia === dia &&
          ultima.id_sala === f.id_sala &&
          ultima.bloque_fin === f.id_bloque - 1 &&
          Math.ceil(ultima.bloque_inicio / 2) === Math.ceil(f.id_bloque / 2)
        ) {
          ultima.bloque_fin = f.id_bloque;
        } else {
          sesiones.push({
            dia,
            bloque_inicio: f.id_bloque,
            bloque_fin: f.id_bloque,
            id_sala: f.id_sala,
            sala_nombre: f.sala.nombre,
          });
        }
      }

      const requeridos = bloquesRequeridos(c);
      const asignados = propias.length;
      const advertencias: AdvertenciaCurso[] = [];
      if (c.cargaDocentes.length === 0) advertencias.push('SIN_DOCENTE');
      if (c.inscritos <= 0) advertencias.push('SIN_INSCRITOS');

      return {
        id_curso: c.id_curso,
        estado:
          asignados >= requeridos ? 'ASIGNADO' : asignados === 0 ? 'NO_ASIGNADO' : 'PARCIAL',
        sesiones,
        bloques_asignados: asignados,
        motivo: null,
        detalle_motivo: null,
        advertencias,
      };
    });
  }

  // ----------------------------------------------------------------------
  // Respuesta para el front
  // ----------------------------------------------------------------------
  private armarRespuesta(
    ctx: Contexto,
    resultados: ResultadoCurso[],
    estado: EstadoHorario | null,
    conMotivos: boolean,
  ): PropuestaHorarioResponse {
    const porId = new Map(resultados.map((r) => [r.id_curso, r]));
    const cursos: CursoPropuesta[] =
      estado === null
        ? []
        : ctx.cursos
            .filter((c) => porId.has(c.id_curso))
            .map((c) => {
              const r = porId.get(c.id_curso)!;
              return {
                id_curso: c.id_curso,
                tipo: c.tipo,
                grupo: c.grupo,
                codigo_asignatura: c.codigo_asignatura,
                nombre_asignatura: c.asignatura.nombre,
                nivel: c.malla!.semestre,
                bloques_requeridos: bloquesRequeridos(c),
                inscritos: c.inscritos,
                docentes: c.cargaDocentes.map((cd) => ({
                  id_usuario: cd.id_usuario,
                  nombre: cd.profesor.usuario.nombre,
                  contrato: cd.profesor.contrato,
                })),
                sesiones: r.sesiones,
                estado: r.estado,
                motivo: r.motivo,
                detalle_motivo: r.detalle_motivo,
                advertencias: r.advertencias,
              };
            })
            .sort(
              (a, b) =>
                a.nivel - b.nivel ||
                a.codigo_asignatura.localeCompare(b.codigo_asignatura),
            );

    return {
      id_plan: ctx.idPlan,
      codigo_carrera: ctx.codigoCarrera,
      periodo: ctx.periodo,
      year: ctx.year,
      estado:
        estado === EstadoHorario.BORRADOR || estado === EstadoHorario.PROPUESTA
          ? estado
          : null,
      con_motivos: conMotivos,
      niveles: ctx.niveles,
      cursos,
      resumen: {
        total_cursos: cursos.length,
        asignados: cursos.filter((c) => c.estado === 'ASIGNADO').length,
        parciales: cursos.filter((c) => c.estado === 'PARCIAL').length,
        no_asignados: cursos.filter((c) => c.estado === 'NO_ASIGNADO').length,
        sin_docente: cursos.filter((c) => c.advertencias.includes('SIN_DOCENTE')).length,
        sin_inscritos: cursos.filter((c) => c.advertencias.includes('SIN_INSCRITOS'))
          .length,
      },
      asignaturas_sin_cursos: estado === null ? [] : ctx.asignaturasSinCursos,
    };
  }

  // Choque de PK: otro plan ocupó la misma sala y bloque mientras se generaba
  private relanzarSiChoque(e: unknown) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw new ConflictException(
        'Otra propuesta ocupó las mismas salas mientras se procesaba. Vuelve a generar la propuesta.',
      );
    }
  }
}
