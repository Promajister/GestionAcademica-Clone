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
  _count: {
    select: {
      horarios: true,
      horariosExternos: true,
      ocupacionesPuntuales: true,
    },
  },
} satisfies Prisma.SalaInclude;

const SALA_DUPLICADA = 'Ya existe una sala registrada con ese nombre.';

@Injectable()
export class SalasService {
  constructor(private prisma: PrismaService) {}

  private async assertNoDuplicada(nombre?: string, excluirId?: number) {
    if (!nombre) return;
    const existente = await this.prisma.sala.findFirst({
      where: {
        nombre,
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
    await this.assertNoDuplicada(dto.nombre);

    try {
      return await this.prisma.sala.create({
        data: {
          nombre: dto.nombre,
          tipo: dto.tipo,
          capacidad: dto.capacidad ?? 22,
          activo: dto.activo ?? true,
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
    if (dto.nombre) {
      await this.assertNoDuplicada(dto.nombre, id);
    }

    try {
      return await this.prisma.sala.update({
        where: { id_sala: id },
        data: {
          ...(dto.nombre !== undefined && { nombre: dto.nombre }),
          ...(dto.tipo !== undefined && { tipo: dto.tipo }),
          ...(dto.capacidad !== undefined && { capacidad: dto.capacidad }),
          ...(dto.activo !== undefined && { activo: dto.activo }),
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
    const enUso =
      (sala._count?.horarios ?? 0) > 0 ||
      (sala._count?.horariosExternos ?? 0) > 0 ||
      (sala._count?.ocupacionesPuntuales ?? 0) > 0;

    if (enUso) {
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
