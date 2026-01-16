import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoCentro as PrismaTipoCentro, TipoCentro as TipoCentroEnum } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { CreateCentroDto } from './dto/create-centro.dto';
import { UpdateCentroDto } from './dto/update-centro.dto';
import { QueryCentroDto } from './dto/query-centro.dto';

@Injectable()
export class CentrosService {
  constructor(private prisma: PrismaService) {}

  // Normaliza "YYYY-MM-DD" | Date | null | undefined -> Date | null | undefined
  private normalizeFecha(value: unknown): Date | null | undefined {
    if (value === undefined) return undefined; // no tocar
    if (value === null || value === '') return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const iso = value.length === 10 ? `${value}T00:00:00` : value;
      const d = new Date(iso);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  // Convierte string del DTO a enum Prisma (incluye NO_CONVENCIONAL)
  private toPrismaTipo(value?: string | null): PrismaTipoCentro | undefined {
  if (value == null) return undefined;

  // `TipoCentroEnum` es el objeto runtime del enum exportado por @prisma/client
  // Usamos indexación dinámica para evitar errores cuando el cliente no está regenerado.
  const enumObj = TipoCentroEnum as unknown as Record<string, PrismaTipoCentro | undefined>;
  const mapped = enumObj[value];

  if (mapped !== undefined) return mapped;

  // Si no existiera en el cliente (p.ej. te falta `prisma generate`), damos mensaje claro.
  throw new BadRequestException(
    `Tipo no permitido: ${value}. ¿Agregaste este valor al schema y corriste "npx prisma generate"?`
  );
}

  // ---------- CREATE ----------
  async create(dto: CreateCentroDto) {
    const fecha = this.normalizeFecha((dto as any).fecha_inicio_asociacion);

    return this.prisma.centroEducativo.create({
      data: {
        nombre: dto.nombre,
        rbd: dto.rbd ?? null,
        tipo: this.toPrismaTipo(dto.tipo),
        region: dto.region,
        comuna: dto.comuna,
        convenio: dto.convenio ?? null,
        direccion: dto.direccion ?? null,
        telefono: dto.telefono ?? null,
        correo: dto.correo ?? null,
        url_rrss: dto.url_rrss ?? null,
        fecha_inicio_asociacion: fecha ?? null,
      },
    });
  }

  // ---------- FIND ALL ----------
  async findAll(q: QueryCentroDto) {
    const pageNum = Number(q.page ?? 1);
    const limitNum = Number(q.limit ?? 10);
    const page = pageNum > 0 ? pageNum : 1;
    const limit = limitNum > 0 ? limitNum : 10;
    const safeLimit = Math.min(limit, 1000);

    const allowedOrderBy = new Set<keyof Prisma.CentroEducativoOrderByWithRelationInput>([
      'id', 'nombre', 'region', 'comuna', 'tipo', 'convenio', 'correo', 'fecha_inicio_asociacion'
    ]);
    const orderByField: keyof Prisma.CentroEducativoOrderByWithRelationInput =
      (q.orderBy && allowedOrderBy.has(q.orderBy as any))
        ? (q.orderBy as keyof Prisma.CentroEducativoOrderByWithRelationInput)
        : 'nombre';
    const orderDir: Prisma.SortOrder = q.orderDir === 'desc' ? 'desc' : 'asc';

    const where: Prisma.CentroEducativoWhereInput = {};

    if (q.tipo) where.tipo = this.toPrismaTipo(q.tipo);

    const s = q.search?.trim();
    if (s) {
      // SIN 'mode' para compatibilidad con tu versión de Prisma
      where.OR = [
        { nombre:   { contains: s } },
        { comuna:   { contains: s } },
        { region:   { contains: s } },
        { correo:   { contains: s } },
        { convenio: { contains: s } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.centroEducativo.findMany({
        where,
        orderBy: { [orderByField]: orderDir },
        skip: (page - 1) * safeLimit,
        take: safeLimit,
        select: {
          id: true,
          nombre: true,
          rbd: true,
          region: true,
          comuna: true,
          direccion: true,
          telefono: true,
          correo: true,
          tipo: true,
          convenio: true,
          url_rrss: true,
          fecha_inicio_asociacion: true,
          _count: { select: { practicas: true, trabajadores: true } },
        },
      }),
      this.prisma.centroEducativo.count({ where }),
    ]);

    return {
      items,
      page,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    };
  }

  // ---------- FIND ONE (DETALLE) ----------
  async findOne(id: number) {
    const item = await this.prisma.centroEducativo.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        rbd: true,
        region: true,
        comuna: true,
        direccion: true,
        telefono: true,
        correo: true,
        tipo: true,
        convenio: true,
        url_rrss: true,
        fecha_inicio_asociacion: true,
        trabajadores: {
          select: {
            id: true,
            rut: true,
            nombre: true,
            rol: true,
            correo: true,
            telefono: true,
            centroId: true,
          },
          orderBy: { nombre: 'asc' },
        },
      },
    });
    if (!item) throw new NotFoundException('Centro educativo no encontrado');
    return item;
  }

  // ---------- UPDATE ----------
  async update(id: number, dto: UpdateCentroDto) {
    try {
      const fecha = this.normalizeFecha((dto as any).fecha_inicio_asociacion);

      return await this.prisma.centroEducativo.update({
        where: { id },
        data: {
          ...(dto.nombre     !== undefined ? { nombre: dto.nombre } : {}),
          ...(dto.rbd        !== undefined ? { rbd: dto.rbd ?? null } : {}),
          ...(dto.tipo       !== undefined ? { tipo: this.toPrismaTipo(dto.tipo) } : {}),
          ...(dto.region     !== undefined ? { region: dto.region ?? null } : {}),
          ...(dto.comuna     !== undefined ? { comuna: dto.comuna ?? null } : {}),
          ...(dto.convenio   !== undefined ? { convenio: dto.convenio ?? null } : {}),
          ...(dto.direccion  !== undefined ? { direccion: dto.direccion ?? null } : {}),
          ...(dto.telefono   !== undefined ? { telefono: dto.telefono ?? null } : {}),
          ...(dto.correo     !== undefined ? { correo: dto.correo ?? null } : {}),
          ...(dto.url_rrss   !== undefined ? { url_rrss: dto.url_rrss ?? null } : {}),
          ...(fecha === undefined ? {} : { fecha_inicio_asociacion: fecha }),
        },
      });
    } catch {
      throw new NotFoundException('Centro educativo no encontrado');
    }
  }

  // ---------- DELETE ----------
  async remove(id: number) {
    try {
      return await this.prisma.centroEducativo.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Centro educativo no encontrado');
    }
  }
}
