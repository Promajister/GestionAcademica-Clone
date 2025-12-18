import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}
  
  private calcularSemestre(fecha: Date): 1 | 2 {
    const mes = fecha.getMonth(); // 0..11
    return mes <= 5 ? 1 : 2;      // Ene-Jun = 1, Jul-Dic = 2
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
      fecha: a.fecha.toISOString(),
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
      fechaTermino: p.fecha_termino!.toISOString(),
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
      generatedAt: new Date().toISOString(),
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
        practicaTutores: {
            include: { tutor: { select: { id: true, nombre: true } } },
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
            supervisoresSet: new Set<string>(),
            mentoresSet: new Set<string>(),
        });
        }

        const b = buckets.get(key);

        // total estudiantes (únicos)
        b.totalEstudiantesSet.add(p.estudianteRut);

        // centros por tipo
        const tipoCentro = p.centro?.tipo ?? 'SIN_TIPO';
        b.centrosPorTipo.set(tipoCentro, (b.centrosPorTipo.get(tipoCentro) ?? 0) + 1);

        // tutores por rol
        for (const pt of p.practicaTutores) {
        if (pt.rol === 'Supervisor') b.supervisoresSet.add(pt.tutor.nombre);
        else b.mentoresSet.add(pt.tutor.nombre);
        }
    }

    // salida serializable
    const series = Array.from(buckets.values())
        .map(b => ({
        periodo: b.key,
        totalEstudiantes: b.totalEstudiantesSet.size,
        centrosPorTipo: Array.from(b.centrosPorTipo.entries()).map(([tipo, total]) => ({ tipo, total })),
        supervisores: Array.from(b.supervisoresSet),
        mentores: Array.from(b.mentoresSet),
        }))
        .sort((a, b) => a.periodo.localeCompare(b.periodo));

    return { fromYear, toYear, tipo: tipo ?? null, groupBy, series };
  }
  
  async getReporteSatisfaccion(params: { anio: number; semestre: 1 | 2; tipo?: string | null }) {
    const { anio, semestre, tipo } = params;

    if (!anio || Number.isNaN(anio)) throw new BadRequestException('Año inválido');
    if (semestre !== 1 && semestre !== 2) throw new BadRequestException('Semestre inválido (1 o 2)');

    const { from, to } = this.rangoAnio(anio);

    // -------------------------
    // 1) PRACTICAS (para total estudiantes y % aprobación)
    // -------------------------
    const practicas = await this.prisma.practica.findMany({
      where: {
        fecha_inicio: { gte: from, lt: to },
        ...(tipo ? { tipo } : {}),
      },
      select: {
        estudianteRut: true,
        estado: true,
        fecha_inicio: true,
      },
    });

    const practicasSemestre = practicas.filter(p =>
      this.calcularSemestre(new Date(p.fecha_inicio)) === semestre
    );

    // Total estudiantes únicos con práctica en ese semestre
    const totalEstudiantes = new Set(practicasSemestre.map(p => p.estudianteRut)).size;

    // % aprobación usando estado (APROBADO / REPROBADO)
    const totalEvaluadas = practicasSemestre.filter(
      p => p.estado === 'APROBADO' || p.estado === 'REPROBADO'
    ).length;

    const aprobadas = practicasSemestre.filter(p => p.estado === 'APROBADO').length;

    const porcentajeAprobacion =
      totalEvaluadas > 0 ? (aprobadas / totalEvaluadas) * 100 : 0;

    // -------------------------
    // 2) ENCUESTAS (para promedio y % satisfacción)
    //    - mezclamos encuestas estudiante + colaborador
    //    - usamos RespuestaSeleccionada con alternativa.puntaje (1..5)
    // -------------------------
    const respuestas = await this.prisma.respuestaSeleccionada.findMany({
      where: {
        alternativaId: { not: null },
        OR: [
          {
            encuestaEstudiante: {
              fecha: { gte: from, lt: to },
              ...(tipo ? { tipo_practica: tipo } : {}),
            },
          },
          {
            encuestaColaborador: {
              fecha: { gte: from, lt: to },
              ...(tipo ? { tipo_practica: tipo } : {}),
            },
          },
        ],
      },
      select: {
        alternativa: { select: { puntaje: true } },
        encuestaEstudiante: { select: { fecha: true } },
        encuestaColaborador: { select: { fecha: true } },
      },
    });

    // Filtrar por semestre CALCULADO desde la fecha real de la encuesta
    const puntajes = respuestas
      .filter(r => {
        const fecha = r.encuestaEstudiante?.fecha ?? r.encuestaColaborador?.fecha;
        if (!fecha) return false;
        return this.calcularSemestre(new Date(fecha)) === semestre;
      })
      .map(r => r.alternativa?.puntaje ?? 0)
      .filter(p => p >= 1 && p <= 5);

    const totalRespuestas = puntajes.length;

    const promedioPuntaje =
      totalRespuestas > 0
        ? puntajes.reduce((sum, p) => sum + p, 0) / totalRespuestas
        : 0;

    // % satisfacción (definición: puntaje 4 o 5)
    const satisfechas = puntajes.filter(p => p >= 4).length;
    const porcentajeSatisfaccion =
      totalRespuestas > 0 ? (satisfechas / totalRespuestas) * 100 : 0;

    return {
      anio,
      semestre,
      tipo: tipo ?? null,
      totalEstudiantes,
      porcentajeAprobacion: Number(porcentajeAprobacion.toFixed(1)),
      encuestas: {
        totalRespuestas,
        promedioPuntaje: Number(promedioPuntaje.toFixed(2)),
        porcentajeSatisfaccion: Number(porcentajeSatisfaccion.toFixed(1)),
      },
      generatedAt: new Date().toISOString(),
    };
  }

}