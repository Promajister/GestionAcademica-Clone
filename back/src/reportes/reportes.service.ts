import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { formatDateEs } from '../common/date-format';
import { calcSatisfaccionFromRespuestas } from './utils/satisfaccion.util';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}
  
  private calcularSemestre(fecha: Date): 1 | 2 {
    const mes = fecha.getMonth();
    return mes <= 5 ? 1 : 2;     
  }

  private rangoAnio(anio: number) {
    const from = new Date(anio, 0, 1);
    const to = new Date(anio + 1, 0, 1);
    return { from, to };
  }

  async getSummary() {
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + 7);

    const [estudiantes, centros, tutores] = await Promise.all([
      this.prisma.estudiante.count(),
      this.prisma.centroEducativo.count(),
      this.prisma.tutor.count(),
    ]);

    const practicasByEstado = await this.prisma.practica.groupBy({
      by: ['estado'],
      _count: { _all: true },
    });

    const enCurso = practicasByEstado.find(x => x.estado === 'EN_CURSO')?._count._all ?? 0;
    const aprobadas = practicasByEstado.find(x => x.estado === 'APROBADO')?._count._all ?? 0;
    const reprobadas = practicasByEstado.find(x => x.estado === 'REPROBADO')?._count._all ?? 0;

    // Actividades recientes 
    const actividades = await this.prisma.actividad.findMany({
    orderBy: { fecha: 'desc' },
    select: {
        id: true,
        nombre_actividad: true,
        fecha: true,
    },
    });

    const recientes = actividades.map(a => ({
      id: a.id,
      nombre: a.nombre_actividad,
      fecha: formatDateEs(a.fecha),
    }));

    // Próximos vencimientos 
    const vencen = await this.prisma.practica.findMany({
    where: {
        estado: 'EN_CURSO',
        fecha_termino: { not: null, gte: now, lte: until },
    },
    include: {
        estudiante: { select: { nombre: true } },
        centro: { select: { nombre: true } },
    },
    orderBy: { fecha_termino: 'asc' },
    });

    const vencimientos = vencen.map(p => ({
      practicaId: p.id,
      estudiante: p.estudiante?.nombre ?? 'Sin estudiante',
      centro: p.centro?.nombre ?? 'Sin centro',
      fechaTermino: formatDateEs(p.fecha_termino!),
      estado: p.estado,
    }));

    // Prácticas inscritas por mes 
    const year = new Date().getFullYear();

    const from = new Date(year, 0, 1);        
    const to = new Date(year + 1, 0, 1);      

    const rows = await this.prisma.$queryRaw<
    { month: number; total: bigint }[]
    >`
    SELECT MONTH(fecha_inicio) AS month, COUNT(*) AS total
    FROM practica
    WHERE fecha_inicio >= ${from}
        AND fecha_inicio < ${to}
    GROUP BY MONTH(fecha_inicio)
    ORDER BY month;
    `;

    const monthLabels = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
    ];

    const practicasPorMes = monthLabels.map((label, index) => {
    const monthNumber = index + 1; 
    const found = rows.find(r => r.month === monthNumber);

    return {
        mes: label,
        value: found ? Number(found.total) : 0,
    };
    });

    const hasAnyData =
      estudiantes + centros + tutores + enCurso + aprobadas + reprobadas > 0 ||
      recientes.length > 0 ||
      vencimientos.length > 0;

    return {
      totals: {
        estudiantes,
        centros,
        tutores,
        practicas: { enCurso, aprobadas, reprobadas },
      },
      charts: {
        practicasPorEstado: [
          { label: 'En curso', value: enCurso },
          { label: 'Aprobadas', value: aprobadas },
          { label: 'Reprobadas', value: reprobadas },
        ],
        practicasPorMes,
      },
      recientes,
      vencimientos,
      generatedAt: formatDateEs(new Date()),
    };
  }
  
  async getIndicadores() {
    const totalPracticas = await this.prisma.practica.count();

    const aprobadas = await this.prisma.practica.count({
        where: { estado: 'APROBADO' },
    });

    const estudiantesEnPractica = await this.prisma.practica.count({
        where: { estado: 'EN_CURSO' },
    });

    const practicasPorTipo = await this.prisma.practica.groupBy({
        by: ['tipo'],
        _count: { _all: true },
    });

    const porcentajeAprobacion =
        totalPracticas > 0
        ? (aprobadas / totalPracticas) * 100
        : 0;

    return {
        cobertura: {
        estudiantesEnPractica,
        practicasPorTipo: practicasPorTipo.map(p => ({
            tipo: p.tipo,
            total: p._count._all,
        })),
        },
        evaluacion: {
        totalPracticas,
        aprobadas,
        porcentajeAprobacion: Number(porcentajeAprobacion.toFixed(1)),
        },
    };
  }

  async getReporteEstudiante(rut: string) {
    const estudiante = await this.prisma.estudiante.findUnique({
        where: { rut },
        include: {
        practicas: {
            include: {
            centro: { select: { nombre: true, tipo: true } },
            practicaTutores: {
                include: {
                tutor: { select: { nombre: true } },
                },
            },
            },
            orderBy: { fecha_inicio: 'asc' },
        },
        },
    });

    if (!estudiante) return null;

    return {
        rut: estudiante.rut,
        nombre: estudiante.nombre,
        plan: estudiante.plan,
        practicas: estudiante.practicas.map(p => {
        const fecha = p.fecha_inicio;
        const semestre = fecha.getMonth() < 6 ? 1 : 2;
        const anio = fecha.getFullYear();

        return {
            id: p.id,
            tipo: p.tipo,
            estado: p.estado,
            notaFinal: p.nota_final,
            anio,
            semestre,
            fechaInicio: p.fecha_inicio,
            fechaTermino: p.fecha_termino,
            centro: p.centro?.nombre,
            tutores: p.practicaTutores.map(t => t.tutor.nombre),
        };
        })
    };
  }
  
  async buscarEstudiantes(nombre: string) {
    const q = nombre.trim();
        if (!q) return [];

        const rows = await this.prisma.estudiante.findMany({
            where: {
                nombre: { contains: q },
            },
            select: {
                rut: true,
                nombre: true,
                plan: true,
            },
            take: 20,
            orderBy: { nombre: 'asc' },
        });
        
        return rows;
  }

  async listarEstudiantes(params: {
    search?: string;
    page?: number;
    limit?: number;
    orderBy?: 'nombre' | 'rut';
    orderDir?: 'asc' | 'desc';
  }) {
    const {
      search,
      page = 1,
      limit = 10,
      orderBy = 'nombre',
      orderDir = 'asc',
    } = params;

    const term = (search ?? '').trim();
    const where: any = {};

    if (term) {
      where.OR = [
        // Estudiante
        { nombre: { contains: term } },
        { rut: { contains: term } },
        { plan: { contains: term } },

        // Centro educativo (por prácticas)
        {
          practicas: {
            some: {
              centro: { nombre: { contains: term } },
            },
          },
        },

        // Supervisor (Tutor con rol Supervisor)
        {
          practicas: {
            some: {
              practicaTutores: {
                some: {
                  rol: 'Supervisor', // enum TipoTutor
                  tutor: { nombre: { contains: term } },
                },
              },
            },
          },
        },
      ];
    }

    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const safePage = Math.max(1, Number(page) || 1);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.estudiante.findMany({
        where,
        orderBy: { [orderBy]: orderDir },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        select: {
          rut: true,
          nombre: true,
          plan: true,
          practicas: {
            select: {
              centro: { select: { nombre: true } },
              practicaTutores: {
                where: { rol: 'Supervisor' },
                select: { tutor: { select: { nombre: true } } },
              },
            },
          },
        },
      }),
      this.prisma.estudiante.count({ where }),
    ]);

    const mapped = items.map((e) => {
      const centros = new Set<string>();
      const supervisores = new Set<string>();

      for (const p of e.practicas ?? []) {
        if (p.centro?.nombre) centros.add(p.centro.nombre);
        for (const pt of p.practicaTutores ?? []) {
          const n = pt.tutor?.nombre;
          if (n) supervisores.add(n);
        }
      }

      return {
        rut: e.rut,
        nombre: e.nombre,
        plan: e.plan,
        centros: Array.from(centros),
        supervisores: Array.from(supervisores),
      };
    });

    return {
      items: mapped,
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    };
  }
  
  async getHistorico(params: { fromYear: number; toYear: number; tipo?: string | null; groupBy: 'semester' | 'year' }) {
    const { fromYear, toYear, tipo, groupBy } = params;

    const from = new Date(fromYear, 0, 1);
    const to = new Date(toYear + 1, 0, 1);

    const practicas = await this.prisma.practica.findMany({
      where: {
        fecha_inicio: { gte: from, lt: to },
        ...(tipo ? { tipo } : {}),
      },
      include: {
        estudiante: { select: { rut: true } },
        centro: { select: { tipo: true } },

        practicaColaboradores: {
          include: { colaborador: { select: { nombre: true } } },
        },

        practicaTutores: {
          include: { tutor: { select: { nombre: true } } },
        },
      },
    });


    type Key = string;
    const buckets = new Map<Key, any>();

    const getKey = (d: Date) => {
        const y = d.getFullYear();
        if (groupBy === 'year') return `${y}`;
        const s = d.getMonth() < 6 ? 1 : 2;
        return `${y}-S${s}`;
    };

    for (const p of practicas) {
        const key = getKey(p.fecha_inicio);
        if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          totalEstudiantesSet: new Set<string>(),
          centrosPorTipo: new Map<string, number>(),
          colaboradoresSet: new Set<string>(),
          supervisoresSet: new Set<string>(),
          talleristasSet: new Set<string>(),
        });
        }

        const b = buckets.get(key);

        // total estudiantes (únicos)
        b.totalEstudiantesSet.add(p.estudianteRut);

        // centros por tipo
        const tipoCentro = p.centro?.tipo ?? 'SIN_TIPO';
        b.centrosPorTipo.set(tipoCentro, (b.centrosPorTipo.get(tipoCentro) ?? 0) + 1);


        for (const pc of p.practicaColaboradores ?? []) {
          const nombreCol = pc.colaborador?.nombre;
          if (nombreCol) {
            b.colaboradoresSet.add(nombreCol);
          }
        }        

        // tutores por rol
        for (const pt of p.practicaTutores ?? []) {
          const nombreTutor = pt.tutor?.nombre;
          if (!nombreTutor) continue;

          if (pt.rol === 'Supervisor') {
            b.supervisoresSet.add(nombreTutor);
          } else if (pt.rol === 'Tallerista') {
            b.talleristasSet.add(nombreTutor);
          }
        }
    }

    // salida serializable
    const series = Array.from(buckets.values())
      .map(b => ({
        periodo: b.key,
        totalEstudiantes: b.totalEstudiantesSet.size,
        centrosPorTipo: Array.from(b.centrosPorTipo.entries()).map(([tipo, total]) => ({ tipo, total })),
        colaboradores: Array.from(b.colaboradoresSet),
        supervisores: Array.from(b.supervisoresSet),
        talleristas: Array.from(b.talleristasSet),
      }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo));

    return { fromYear, toYear, tipo: tipo ?? null, groupBy, series };
  }
  
  async getSatisfaccion(params: { anio: number; semestre: 1 | 2; tipo?: string | null }) {
    const { anio, semestre, tipo } = params;

    if (!anio || Number.isNaN(anio)) {
      throw new BadRequestException('Año inválido');
    }
    if (semestre !== 1 && semestre !== 2) {
      throw new BadRequestException('Semestre inválido');
    }

    const from = new Date(anio, semestre === 1 ? 0 : 6, 1);
    const to   = new Date(anio, semestre === 1 ? 6 : 12, 1);

    // -------------------------
    // PRÁCTICAS (incluye colaboradores)
    // -------------------------
    const practicas = await this.prisma.practica.findMany({
      where: {
        fecha_inicio: { gte: from, lt: to },
        ...(tipo ? { tipo } : {}),
      },
      select: {
        estudianteRut: true,
        estado: true,
        practicaColaboradores: { select: { colaboradorId: true } }, // ✅
      },
    });

    const totalPracticas = practicas.length;

    const estudiantesUnicos = new Set(practicas.map(p => p.estudianteRut)).size;

    const colaboradoresUnicos = new Set(
      practicas.flatMap(p => p.practicaColaboradores?.map(pc => pc.colaboradorId) ?? [])
    ).size;

    const aprobadas = practicas.filter(p => p.estado === 'APROBADO').length;
    const reprobadas = practicas.filter(p => p.estado === 'REPROBADO').length;
    const enCurso = practicas.filter(p => p.estado === 'EN_CURSO').length;

    const pct = (n: number) =>
      totalPracticas > 0 ? Number(((n / totalPracticas) * 100).toFixed(1)) : 0;

    const porcentajes = {
      aprobadas: pct(aprobadas),
      reprobadas: pct(reprobadas),
      enCurso: pct(enCurso),
    };

    // -------------------------
    // ENCUESTAS (por semestre relacionado)
    // -------------------------
    const whereEncuestas = {
      semestre: { is: { anio, semestre } },
      ...(tipo ? { tipo_practica: tipo } : {}),
    };

    const [totalEncuestasEstudiantes, totalEncuestasColaboradores] = await Promise.all([
      this.prisma.encuestaEstudiante.count({ where: whereEncuestas }),
      this.prisma.encuestaColaborador.count({ where: whereEncuestas }),
    ]);

    const [encEst, encCol] = await Promise.all([
      this.prisma.encuestaEstudiante.findMany({
        where: whereEncuestas,
        select: {
          id: true,
          respuestas: {
            select: { alternativa: { select: { descripcion: true } } },
          },
        },
      }),
      this.prisma.encuestaColaborador.findMany({
        where: whereEncuestas,
        select: {
          id: true,
          respuestas: {
            select: { alternativa: { select: { descripcion: true } } },
          },
        },
      }),
    ]);

    const respuestasEst = encEst.flatMap(e => e.respuestas ?? []);
    const respuestasCol = encCol.flatMap(e => e.respuestas ?? []);

    const satEst = calcSatisfaccionFromRespuestas(respuestasEst);
    const satCol = calcSatisfaccionFromRespuestas(respuestasCol);

    return {
      anio,
      semestre,
      tipo: tipo ?? null,

      practicas: {
        totalPracticas,
        estudiantesUnicos,
        colaboradoresUnicos, // ✅ ahora sí definido
        aprobadas,
        reprobadas,
        enCurso,
        porcentajes,
      },

      encuestasEstudiantes: {
        totalEncuestas: totalEncuestasEstudiantes,
        totalAlternativasRespondidas: satEst.totalAlternativasRespondidas,
        porcentajeSatisfaccion: satEst.porcentajeSatisfaccion,
        totalScore: satEst.totalScore,
        totalMaxScore: satEst.totalMaxScore,
        totalExcluidas: satEst.totalExcluidas,
      },

      encuestasColaboradores: {
        totalEncuestas: totalEncuestasColaboradores,
        totalAlternativasRespondidas: satCol.totalAlternativasRespondidas,
        porcentajeSatisfaccion: satCol.porcentajeSatisfaccion,
        totalScore: satCol.totalScore,
        totalMaxScore: satCol.totalMaxScore,
        totalExcluidas: satCol.totalExcluidas,
      },

      generatedAt: formatDateEs(new Date()),
    };
  }

}
