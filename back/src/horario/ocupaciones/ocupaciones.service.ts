import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { CreateOcupacionDto } from './dto/create-ocupacion.dto';
import { QueryOcupacionDto } from './dto/query-ocupacion.dto';
import { mismaJornada, rangoBloques } from '../common/grilla';
import { choqueConOcupaciones } from '../common/choques';

@Injectable()
export class OcupacionesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOcupacionDto) {
    if (dto.bloque_fin < dto.bloque_inicio) {
      throw new BadRequestException(
        'bloque_fin no puede ser menor que bloque_inicio',
      );
    }
    if (!mismaJornada(dto.bloque_inicio, dto.bloque_fin)) {
      throw new BadRequestException(
        'Un rango no puede cruzar la colación entre los bloques 6 y 7',
      );
    }

    const sala = await this.prisma.sala.findUnique({
      where: { id_sala: dto.id_sala },
    });
    if (!sala) throw new NotFoundException('Sala no encontrada');
    if (!sala.activo) {
      throw new BadRequestException(`La sala ${sala.nombre} está inactiva`);
    }

    const fecha = new Date(dto.fecha + 'T00:00:00.000Z');
    const bloques = rangoBloques(dto.bloque_inicio, dto.bloque_fin);

    for (const num of bloques) {
      const choque = await choqueConOcupaciones(this.prisma, {
        id_sala: dto.id_sala,
        bloque_numero: num,
        fecha,
      });
      if (choque) {
        throw new ConflictException(choque);
      }
    }

    await this.prisma.$transaction(
      bloques.map((num) =>
        this.prisma.ocupacionPuntual.create({
          data: {
            id_sala: dto.id_sala,
            id_bloque: num,
            fecha,
          },
        }),
      ),
    );

    return {
      mensaje: 'Ocupación registrada exitosamente',
      fecha: dto.fecha,
      id_sala: dto.id_sala,
      bloques,
    };
  }

  async findAll(q: QueryOcupacionDto) {
    const where: Prisma.OcupacionPuntualWhereInput = {};
    if (q.id_sala) where.id_sala = q.id_sala;
    if (q.desde || q.hasta) {
      where.fecha = {
        ...(q.desde && { gte: new Date(q.desde + 'T00:00:00.000Z') }),
        ...(q.hasta && { lte: new Date(q.hasta + 'T23:59:59.999Z') }),
      };
    }

    const rows = await this.prisma.ocupacionPuntual.findMany({
      where,
      include: {
        sala: true,
        bloque: true,
      },
      orderBy: [{ fecha: 'asc' }, { id_bloque: 'asc' }],
    });

    return rows.map((r) => ({
      fecha: r.fecha.toISOString().slice(0, 10),
      id_bloque: r.id_bloque,
      id_sala: r.id_sala,
      sala: r.sala,
      bloque: r.bloque,
      hora_inicio: r.bloque.horaInicio,
      hora_fin: r.bloque.horaFin,
    }));
  }

  async remove(id_sala: number, id_bloque: number, fechaStr: string) {
    const fecha = new Date(fechaStr + 'T00:00:00.000Z');
    const row = await this.prisma.ocupacionPuntual.findUnique({
      where: {
        id_bloque_id_sala_fecha: {
          id_bloque,
          id_sala,
          fecha,
        },
      },
    });
    if (!row) throw new NotFoundException('Ocupación no encontrada');

    await this.prisma.ocupacionPuntual.delete({
      where: {
        id_bloque_id_sala_fecha: {
          id_bloque,
          id_sala,
          fecha,
        },
      },
    });
    return { mensaje: 'Ocupación eliminada correctamente' };
  }
}
