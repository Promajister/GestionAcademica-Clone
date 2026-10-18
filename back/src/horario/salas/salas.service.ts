import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { CreateSalaDto } from './dto/create-sala.dto';
import { UpdateSalaDto } from './dto/update-sala.dto';
import { QuerySalaDto } from './dto/query-sala.dto';

// Permite saber si la sala está en uso (front de ADM-F01-T3 y regla CA3)
const CONTEO_USO = {
  _count: { select: { bloques_horarios: true, ocupaciones: true } },
} satisfies Prisma.SalaInclude;

const SALA_DUPLICADA =
  'Ya existe una sala registrada con ese nombre o código oficial.';

@Injectable()
export class SalasService {
  constructor(private prisma: PrismaService) {}

  // La comparación es case/accent-insensitive por el collation utf8mb4_unicode_ci de la tabla
  private async assertNoDuplicada(
    nombre?: string,
    codigo?: string,
    excluirId?: number,
  ) {
    const or: Prisma.SalaWhereInput[] = [];
    if (nombre) or.push({ nombre });
    if (codigo) or.push({ codigo });
    if (or.length === 0) return;

    const existente = await this.prisma.sala.findFirst({
      where: {
        OR: or,
        ...(excluirId !== undefined && { NOT: { id_sala: excluirId } }),
      },
    });
    if (existente) throw new ConflictException(SALA_DUPLICADA);
  }

  // Cubre la carrera entre la validación previa y el insert/update
  private rethrowDuplicada(e: unknown): never {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw new ConflictException(SALA_DUPLICADA);
    }
    throw e;
  }

  // ---------- CREATE ----------
  async create(dto: CreateSalaDto) {
    await this.assertNoDuplicada(dto.nombre, dto.codigo);

    try {
      return await this.prisma.sala.create({
        data: {
          nombre: dto.nombre,
          codigo: dto.codigo,
          tipo: dto.tipo,
          capacidad: dto.capacidad,
          activo: dto.activo,
        },
      });
    } catch (e) {
      this.rethrowDuplicada(e);
    }
  }

  // ---------- FIND ALL ----------
  findAll(q: QuerySalaDto) {
    return this.prisma.sala.findMany({
      where: q.soloActivas ? { activo: true } : undefined,
      include: CONTEO_USO,
      orderBy: { nombre: 'asc' },
    });
  }

  // ---------- FIND ONE ----------
  async findOne(id: number) {
    const sala = await this.prisma.sala.findUnique({
      where: { id_sala: id },
      include: CONTEO_USO,
    });
    if (!sala) throw new NotFoundException('Sala no encontrada');
    return sala;
  }

  // ---------- UPDATE ----------
  async update(id: number, dto: UpdateSalaDto) {
    await this.findOne(id);
    await this.assertNoDuplicada(dto.nombre, dto.codigo, id);

    try {
      return await this.prisma.sala.update({
        where: { id_sala: id },
        data: {
          nombre: dto.nombre,
          codigo: dto.codigo,
          tipo: dto.tipo,
          capacidad: dto.capacidad,
          activo: dto.activo,
        },
      });
    } catch (e) {
      this.rethrowDuplicada(e);
    }
  }

  // ---------- DELETE (ADM-F01 CA3) ----------
  // Una sala en uso en el horario (clases u ocupaciones) no se elimina: se desactiva.
  async remove(id: number) {
    const sala = await this.findOne(id);

    if (sala._count.bloques_horarios > 0 || sala._count.ocupaciones > 0) {
      const actualizada = await this.prisma.sala.update({
        where: { id_sala: id },
        data: { activo: false },
      });
      return {
        accion: 'DESACTIVADA',
        mensaje:
          'La sala está en uso en el horario, por lo que no puede eliminarse y ha sido desactivada.',
        sala: actualizada,
      };
    }

    await this.prisma.sala.delete({ where: { id_sala: id } });
    return { accion: 'ELIMINADA', mensaje: 'Sala eliminada correctamente.' };
  }
}
