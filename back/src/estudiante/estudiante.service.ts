import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { QueryEstudianteDto } from './dto/query-estudiante.dto';
import dayjs from 'dayjs';

@Injectable()
export class EstudianteService {
  constructor(private prisma: PrismaService) {}

  async findAll(q: QueryEstudianteDto) {
    const practicaFilter: Prisma.PracticaWhereInput = {
      ...(q.estadoPractica ? { estado: q.estadoPractica as any } : {}),
      ...(q.tipoPractica ? { tipo: { contains: q.tipoPractica } } : {}),
      ...(q.anio || q.semestre
        ? (() => {
            const year = q.anio ?? dayjs().year();
            const sem = q.semestre;
            const start = sem === 2 ? dayjs(`${year}-07-01`) : dayjs(`${year}-01-01`);
            const end =
              sem === 2
                ? dayjs(`${year}-12-31`).endOf('day')
                : dayjs(`${year}-06-30`).endOf('day');
            return { fecha_inicio: { gte: start.toDate(), lte: end.toDate() } };
          })()
        : q.anio
        ? {
            fecha_inicio: {
              gte: dayjs(`${q.anio}-01-01`).toDate(),
              lte: dayjs(`${q.anio}-12-31`).endOf('day').toDate(),
            },
          }
        : {}),
    };

    const where: Prisma.EstudianteWhereInput = {
      ...(q.nombre ? { nombre: { contains: q.nombre } } : {}),
      ...(q.carrera ? { plan: { contains: q.carrera } } : {}),
      ...(Object.keys(practicaFilter).length
        ? { practicas: { some: practicaFilter } }
        : q.estadoPractica
        ? { practicas: { some: { estado: q.estadoPractica as any } } }
        : {}),
    };

    const estudiantes = await this.prisma.estudiante.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: {
        practicas: {
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
          select: { estado: true, fecha_inicio: true, fecha_termino: true, tipo: true },
        },
      },
    });

    return estudiantes.map((e) => ({
      rut: e.rut,
      nombre: e.nombre,
      plan: e.plan,
      email: e.email,
      fono: e.fono,
      estadoPractica: e.practicas[0]?.estado ?? null,
      ultimaPractica: e.practicas[0]
        ? {
            fecha_inicio: e.practicas[0].fecha_inicio,
            fecha_termino: e.practicas[0].fecha_termino,
            tipo: e.practicas[0].tipo,
          }
        : null,
    }));
  }

  async findOne(rut: string) {
    const normalizedRut = rut.replace(/[.-]/g, '').toUpperCase();

    const estudiante = await this.prisma.estudiante.findFirst({
      where: {
        OR: [
          { rut },
          { rut: normalizedRut },
          { rut: rut.toUpperCase() },
        ],
      },
      include: {
        practicas: {
          orderBy: { fecha_inicio: 'desc' },
          include: {
            practicaColaboradores: { include: { colaborador: true } },
            practicaTutores: { include: { tutor: true } },
          },
        },
      },
    });

    if (!estudiante) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    let actividades: any[] = [];
    try {
      actividades = await this.prisma.actividad.findMany({
        where: {
          OR: [
            { estudiantes: { contains: rut } },
            { estudiantes: { contains: estudiante.nombre } },
          ],
        },
        orderBy: { fecha: 'desc' },
        select: {
          id: true,
          estudiantes: true,
          fecha: true,
          horario: true,
          lugar: true,
          archivo_adjunto: true,
        },
      });
    } catch (err: any) {
      // Si la tabla tiene columnas desalineadas con el schema Prisma, retornamos sin actividades
      if (err?.code !== 'P2022') {
        throw err;
      }
    }

    return { ...estudiante, actividades };
  }
}
