import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

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
    
    async getReporteSatisfaccion(anio: number) {
    const from = new Date(anio, 0, 1);
    const to = new Date(anio + 1, 0, 1);

    const respuestas = await this.prisma.respuestaSeleccionada.findMany({
        where: {
        encuestaEstudiante: {
            fecha: { gte: from, lt: to },
        },
        alternativa: { isNot: null },
        },
        include: {
        alternativa: true,
        },
    });

    const total = respuestas.length;
    const promedio =
        total > 0
        ? respuestas.reduce((sum, r) => sum + (r.alternativa?.puntaje ?? 0), 0) /
            total
        : 0;

    return {
        totalRespuestas: total,
        promedioSatisfaccion: Number(promedio.toFixed(2)),
    };
    }


}