import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiaSemana, Prisma, TipoOcupacion } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { CreateOcupacionDto } from './dto/create-ocupacion.dto';
import { QueryOcupacionDto } from './dto/query-ocupacion.dto';
import { bloquePorNumero, mismaJornada } from '../common/grilla';
import { choqueConOcupaciones, formatoFecha, hoyUtc } from '../common/choques';

// getUTCDay(): 0 = domingo ... 6 = sábado
const DIAS_POR_INDICE: (DiaSemana | null)[] = [
  null,
  DiaSemana.LUNES,
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  null,
];

const INCLUDE_OCUPACION = {
  sala: true,
  usuario: { select: { id: true, nombre: true, email: true } },
} satisfies Prisma.Ocupacion_salaInclude;

const fechaUtc = (fecha: string) => new Date(`${fecha}T00:00:00Z`);

type OcupacionCompleta = Prisma.Ocupacion_salaGetPayload<{
  include: typeof INCLUDE_OCUPACION;
}>;

// `fecha` sale como "YYYY-MM-DD": el DateFormatInterceptor global formatea con
// hora local y una fecha @db.Date (medianoche UTC) se vería un día antes en Chile.
const serializar = (o: OcupacionCompleta) => ({
  ...o,
  fecha: o.fecha ? formatoFecha(o.fecha) : null,
});

@Injectable()
export class OcupacionesService {
  constructor(private prisma: PrismaService) {}

  // ---------- CREATE ----------
  async create(dto: CreateOcupacionDto, id_usuario: number) {
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

    const { dia, fecha } = this.resolverDiaYFecha(dto);

    const creada = await this.prisma.$transaction(async (tx) => {
      const sala = await tx.sala.findUnique({
        where: { id_sala: dto.id_sala },
      });
      if (!sala) throw new NotFoundException('Sala no encontrada');
      if (!sala.activo) {
        throw new BadRequestException(`La ${sala.nombre} está desactivada`);
      }

      const clase = await tx.bloque_horario.findFirst({
        where: {
          id_sala: dto.id_sala,
          dia,
          bloque_numero: { gte: dto.bloque_inicio, lte: dto.bloque_fin },
        },
        include: { curso: true },
        orderBy: { bloque_numero: 'asc' },
      });
      if (clase) {
        throw new ConflictException(
          `La ${sala.nombre} tiene clase de "${clase.curso.nombre}" el ${dia} en el bloque ${clase.bloque_numero} (${clase.hora_inicio}-${clase.hora_fin})`,
        );
      }

      const choque = await choqueConOcupaciones(tx, {
        id_sala: dto.id_sala,
        dia,
        inicio: dto.bloque_inicio,
        fin: dto.bloque_fin,
        fecha,
      });
      if (choque) throw new ConflictException(choque);

      return tx.ocupacion_sala.create({
        data: {
          tipo: dto.tipo,
          fecha: fecha ?? null,
          dia,
          bloque_inicio: dto.bloque_inicio,
          bloque_fin: dto.bloque_fin,
          hora_inicio: bloquePorNumero(dto.bloque_inicio).hora_inicio,
          hora_fin: bloquePorNumero(dto.bloque_fin).hora_fin,
          motivo: dto.motivo,
          solicitante: dto.solicitante,
          id_sala: dto.id_sala,
          id_usuario,
        },
        include: INCLUDE_OCUPACION,
      });
    });
    return serializar(creada);
  }

  // ---------- FIND ALL ----------
  async findAll(q: QueryOcupacionDto) {
    const rangoFechas: Prisma.DateTimeNullableFilter = {
      ...(q.desde && { gte: fechaUtc(q.desde) }),
      ...(q.hasta && { lte: fechaUtc(q.hasta) }),
    };

    const ocupaciones = await this.prisma.ocupacion_sala.findMany({
      where: {
        id_sala: q.id_sala,
        tipo: q.tipo,
        dia: q.dia,
        ...((q.desde || q.hasta) && {
          OR: [{ tipo: TipoOcupacion.SEMESTRAL }, { fecha: rangoFechas }],
        }),
      },
      include: INCLUDE_OCUPACION,
      orderBy: [{ fecha: 'asc' }, { dia: 'asc' }, { bloque_inicio: 'asc' }],
    });
    return ocupaciones.map(serializar);
  }

  // ---------- FIND ONE ----------
  async findOne(id: number) {
    const ocupacion = await this.prisma.ocupacion_sala.findUnique({
      where: { id_ocupacion: id },
      include: INCLUDE_OCUPACION,
    });
    if (!ocupacion) throw new NotFoundException('Ocupación no encontrada');
    return serializar(ocupacion);
  }

  // ---------- DELETE ----------
  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.ocupacion_sala.delete({ where: { id_ocupacion: id } });
    return { mensaje: 'Ocupación eliminada correctamente.' };
  }

  // PUNTUAL: el día sale de la fecha. SEMESTRAL: se usa el día indicado.
  private resolverDiaYFecha(dto: CreateOcupacionDto): {
    dia: DiaSemana;
    fecha?: Date;
  } {
    if (dto.tipo === TipoOcupacion.SEMESTRAL) {
      if (dto.fecha) {
        throw new BadRequestException(
          'Una ocupación SEMESTRAL no lleva fecha, solo dia',
        );
      }
      return { dia: dto.dia! };
    }

    const fecha = fechaUtc(dto.fecha!);
    if (fecha < hoyUtc()) {
      throw new BadRequestException('No se puede reservar una fecha pasada');
    }
    const dia = DIAS_POR_INDICE[fecha.getUTCDay()];
    if (!dia) {
      throw new BadRequestException('La fecha debe ser de lunes a viernes');
    }
    if (dto.dia && dto.dia !== dia) {
      throw new BadRequestException(
        `La fecha ${dto.fecha} es ${dia}, no ${dto.dia}`,
      );
    }
    return { dia, fecha };
  }
}
