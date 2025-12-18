import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateColaboradorDto } from './dto/create-colaborador.dto';
import { UpdateColaboradorDto } from './dto/update-colaborador.dto';
import { QueryColaboradorDto } from './dto/query-colaborador.dto';
import { PrismaService } from 'prisma/prisma.service';
import { normalizeRut } from 'src/validador/rut.util';

@Injectable()
export class ColaboradoresService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateColaboradorDto) {
    // Acepta 'cargo' (string) o 'cargos' (string[])
    const cargosList = Array.isArray((dto as any).cargos)
      ? ((dto as any).cargos as string[])
          .filter((c) => !!c && c.trim())
          .map((c) => ({ cargo: c.trim() }))
      : dto.cargo && dto.cargo.trim()
      ? [{ cargo: dto.cargo.trim() }]
      : [];

    const { cargo, cargos, ...rest } = dto as any;

    return this.prisma.colaborador.create({
      data: {
        ...rest,
        rut: normalizeRut(dto.rut),
        ...(cargosList.length ? { cargos: { create: cargosList } } : {}),
      },
      include: { cargos: true },
    });
  }

  async findAll(q: QueryColaboradorDto) {
    const { search, page = 1, limit = 10, orderBy = 'nombre', orderDir = 'asc' } = q;
    const where = {
      ...(search
        ? {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' } },
              { rut: { contains: search, mode: 'insensitive' } },
              { correo: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.colaborador.findMany({
        where,
        orderBy: { [orderBy]: orderDir },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          rut: true,
          nombre: true,
          correo: true,
          telefono: true,
          direccion: true,
          universidad_egreso: true,
          cargos: { select: { id: true, cargo: true } },
        },
      }),
      this.prisma.colaborador.count({ where }),
    ]);

    const itemsWithCargo = items.map((it: any) => ({
      ...it,
      cargo: Array.isArray(it.cargos) && it.cargos.length ? it.cargos.map((c: any) => c.cargo).join(', ') : undefined,
    }));

    return {
      items: itemsWithCargo,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }


  async update(id: number, dto: UpdateColaboradorDto) {
    try {
      const cargosList = Array.isArray((dto as any).cargos)
        ? ((dto as any).cargos as string[])
            .filter((c) => !!c && c.trim())
            .map((c) => ({ cargo: c.trim() }))
        : (dto.cargo && (dto.cargo as string).trim())
        ? [{ cargo: (dto.cargo as string).trim() }]
        : [];

      const { cargo, cargos, ...rest } = dto as any;
      
      if (rest.rut !== undefined) {
        rest.rut = normalizeRut(rest.rut);
      }

      return await this.prisma.colaborador.update({
        where: { id },
        data: {
          ...rest,
          ...(cargo !== undefined || cargos !== undefined
            ? { cargos: { deleteMany: {}, ...(cargosList.length ? { create: cargosList } : {}) } }
            : {}),
        },
        include: { cargos: true },
      });
    } catch {
      throw new NotFoundException('Colaborador no encontrado');
    }
  }

  async remove(id: number) {
    try {
      return await this.prisma.colaborador.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Colaborador no encontrado');
    }
  }
}
