import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateActividadEgresadosDto } from './dto/crear-actividad-egresados.dto';
import { UpdateActividadEgresadosDto } from './dto/actualizar-actividad-egresados.dto';
import { QueryActividadEgresadosDto } from './dto/consulta-actividad-egresados.dto';

@Injectable()
export class ActividadEgresadosService {
  constructor(private prisma: PrismaService) {}

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
        .filter((item) => item.rut && item.nombre);
    } catch {
      return [];
    }
  }

  private parseEgresados(raw?: string): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((rut) => (typeof rut === 'string' ? rut.trim() : ''))
        .filter((rut) => !!rut);
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

  private async validarEgresados(ruts: string[]) {
    if (!ruts.length) {
      throw new BadRequestException('Debe indicar al menos un egresado participante.');
    }

    const egresados = await this.prisma.estudiante.findMany({
      where: { rut: { in: ruts }, egresado: true },
      select: { rut: true },
    });

    if (egresados.length !== ruts.length) {
      const validos = new Set(egresados.map((e) => e.rut));
      const faltantes = ruts.filter((rut) => !validos.has(rut));
      throw new BadRequestException(
        `Algunos RUT no son egresados o no existen: ${faltantes.join(', ')}`
      );
    }
  }

  async create(dto: CreateActividadEgresadosDto) {
    const fecha = dto.fechaRegistro ? new Date(dto.fechaRegistro) : new Date();
    const mes = this.obtenerMesDesdeFecha(fecha);
    const terceros = dto.tercerosAsistieron ? this.parseTerceros(dto.terceros) : [];
    const egresados = this.parseEgresados(dto.egresados);

    if (dto.tercerosAsistieron && terceros.length === 0) {
      throw new BadRequestException('Debe indicar los terceros asistentes.');
    }

    await this.validarEgresados(egresados);

    return this.prisma.actividadEgresado.create({
      data: {
        nombre_actividad: dto.titulo,
        satisfaccion: null,
        lugar: dto.descripcion,
        horario: dto.horario,
        terceros_asistieron: dto.tercerosAsistieron ?? false,
        fecha,
        mes,
        archivo_adjunto: dto.evidenciaUrl ?? null,
        egresados: {
          create: egresados.map((rut) => ({
            estudiante: { connect: { rut } },
          })),
        },
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
        egresados: { include: { estudiante: true } },
        terceros: { include: { tercero: true } },
      },
    });
  }

  async findAll(q: QueryActividadEgresadosDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 10;

    const where: any = {};

    if (q.mes) {
      where.mes = q.mes.toUpperCase();
    }

    const s = q.search?.trim();
    if (s) {
      where.nombre_actividad = { contains: s, mode: 'insensitive' };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.actividadEgresado.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          egresados: { include: { estudiante: true } },
          terceros: { include: { tercero: true } },
        },
      }),
      this.prisma.actividadEgresado.count({ where }),
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
    const actividad = await this.prisma.actividadEgresado.findUnique({
      where: { id },
      include: {
        egresados: { include: { estudiante: true } },
        terceros: { include: { tercero: true } },
      },
    });
    if (!actividad) throw new NotFoundException('Actividad no encontrada');
    return actividad;
  }

  async update(id: number, dto: UpdateActividadEgresadosDto) {
    const data: any = {};
    const terceros = dto.terceros !== undefined ? this.parseTerceros(dto.terceros) : null;
    const egresados = dto.egresados !== undefined ? this.parseEgresados(dto.egresados) : null;

    if (dto.titulo !== undefined) data.nombre_actividad = dto.titulo;
    if (dto.satisfaccion !== undefined) data.satisfaccion = dto.satisfaccion;
    if (dto.descripcion !== undefined) data.lugar = dto.descripcion;
    if (dto.horario !== undefined) data.horario = dto.horario;
    if (dto.tercerosAsistieron !== undefined) data.terceros_asistieron = dto.tercerosAsistieron;
    if (dto.evidenciaUrl !== undefined) data.archivo_adjunto = dto.evidenciaUrl;

    if (dto.fechaRegistro !== undefined) {
      const fecha = new Date(dto.fechaRegistro);
      data.fecha = fecha;
      data.mes = this.obtenerMesDesdeFecha(fecha);
    }

    if (dto.tercerosAsistieron === true && terceros !== null && terceros.length === 0) {
      throw new BadRequestException('Debe indicar los terceros asistentes.');
    }

    if (dto.tercerosAsistieron === false) {
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

    if (egresados !== null) {
      await this.validarEgresados(egresados);
      data.egresados = {
        deleteMany: {},
        create: egresados.map((rut) => ({
          estudiante: { connect: { rut } },
        })),
      };
    }

    try {
      return await this.prisma.actividadEgresado.update({
        where: { id },
        data,
        include: {
          egresados: { include: { estudiante: true } },
          terceros: { include: { tercero: true } },
        },
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
      return await this.prisma.actividadEgresado.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Actividad no encontrada');
    }
  }
}
