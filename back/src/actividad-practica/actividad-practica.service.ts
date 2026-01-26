import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateActividadPracticaDto } from './dto/crear-act-practica.dto';
import { UpdateActividadPracticaDto } from './dto/actualizar-act-practica.dto';
import { QueryActividadPracticaDto } from './dto/consulta-act-practica.dto';

@Injectable()
export class ActividadPracticaService {
  constructor(private prisma: PrismaService) {}

  private parseBoolean(value?: boolean | string): boolean | undefined {
    if (value === undefined || value === null) return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return undefined;
  }

  private generarRutFicticio(nombre: string, index: number): string {
    const base = nombre
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'tercero';
    const suffix = `${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`;
    return `SIN-RUT-${base}-${suffix}`;
  }

  private parseTerceros(raw?: string): { rut: string; nombre: string }[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => ({
          rut: typeof item?.rut === 'string' ? item.rut.trim() : '',
          nombre: typeof item?.nombre === 'string' ? item.nombre.trim() : '',
        }))
        .filter((item) => item.nombre)
        .map((item, index) => ({
          rut: item.rut || this.generarRutFicticio(item.nombre, index),
          nombre: item.nombre,
        }));
    } catch {
      return [];
    }
  }

  private obtenerMesDesdeFecha(fecha: Date): string {
    const meses = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    return meses[fecha.getMonth()];
  }

  async create(dto: CreateActividadPracticaDto) {
    const fecha = dto.fechaRegistro ? new Date(dto.fechaRegistro) : new Date();
    const mes = this.obtenerMesDesdeFecha(fecha); 
    const tercerosAsistieron = this.parseBoolean(dto.tercerosAsistieron) ?? false;
    const terceros = tercerosAsistieron ? this.parseTerceros(dto.terceros) : [];
    if (tercerosAsistieron && terceros.length === 0) {
      throw new BadRequestException('Debe indicar los terceros asistentes.');
    }

    const actividad = await this.prisma.actividad.create({
      data: {
        nombre_actividad: dto.titulo,
        lugar: dto.descripcion,
        horario: dto.tallerista,
        estudiantes: dto.estudiante,
        terceros_asistieron: tercerosAsistieron,
        fecha,
        mes, 
        archivo_adjunto: dto.evidenciaUrl ?? null,
        terceros: terceros.length
          ? {
              create: terceros.map((tercero) => ({
                tercero: {
                  connectOrCreate: {
                    where: { rut: tercero.rut },
                    create: { rut: tercero.rut, nombre: tercero.nombre },
                  },
                },
              })),
            }
          : undefined,
      },
      include: {
        terceros: { include: { tercero: true } },
      },
    });

    return actividad;
  }

  async findAll(q: QueryActividadPracticaDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 10;

    const where: any = {};

    // Filtrar por mes 
    if (q.mes) {
      where.mes = q.mes.toUpperCase();
    }

    // Búsqueda por título
    const s = q.search?.trim();
    if (s) {
      where.nombre_actividad = { contains: s, mode: 'insensitive' };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.actividad.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { terceros: { include: { tercero: true } } },
      }),
      this.prisma.actividad.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const actividad = await this.prisma.actividad.findUnique({
      where: { id },
      include: { terceros: { include: { tercero: true } } },
    });
    if (!actividad) throw new NotFoundException('Actividad no encontrada');
    return actividad;
  }

  async update(id: number, dto: UpdateActividadPracticaDto) {
    const data: any = {};
    const terceros = dto.terceros !== undefined ? this.parseTerceros(dto.terceros) : null;
    const tercerosAsistieron = this.parseBoolean(dto.tercerosAsistieron);

    if (dto.titulo !== undefined) data.nombre_actividad = dto.titulo;
    if (dto.descripcion !== undefined) data.lugar = dto.descripcion;
    if (dto.tallerista !== undefined) data.horario = dto.tallerista;
    if (dto.estudiante !== undefined) data.estudiantes = dto.estudiante;
    if (tercerosAsistieron !== undefined) data.terceros_asistieron = tercerosAsistieron;
    if (dto.evidenciaUrl !== undefined) data.archivo_adjunto = dto.evidenciaUrl;

    if (dto.fechaRegistro !== undefined) {
      const fecha = new Date(dto.fechaRegistro);
      data.fecha = fecha;
      data.mes = this.obtenerMesDesdeFecha(fecha);
    }

    if (tercerosAsistieron === true && terceros !== null && terceros.length === 0) {
      throw new BadRequestException('Debe indicar los terceros asistentes.');
    }

    if (tercerosAsistieron === false) {
      data.terceros = { deleteMany: {} };
    } else if (terceros !== null) {
      data.terceros = {
        deleteMany: {},
        create: terceros.map((tercero) => ({
          tercero: {
            connectOrCreate: {
              where: { rut: tercero.rut },
              create: { rut: tercero.rut, nombre: tercero.nombre },
            },
          },
        })),
      };
    }

    try {
      return await this.prisma.actividad.update({
        where: { id },
        data,
        include: { terceros: { include: { tercero: true } } },
      });
    } catch {
      throw new NotFoundException('Actividad no encontrada');
    }
  }

  async findTerceroByRut(rut: string) {
    const tercero = await this.prisma.tercero.findUnique({ where: { rut } });
    return tercero ?? null;
  }

  async remove(id: number) {
    try {
      return await this.prisma.actividad.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Actividad no encontrada');
    }
  }
}
