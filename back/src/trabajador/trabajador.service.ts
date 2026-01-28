import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTrabajadorDto } from './dto/create-trabajador.dto';
import { UpdateTrabajadorDto } from './dto/update-trabajador.dto';
import { PrismaService } from 'prisma/prisma.service';
import { normalizeRut } from 'src/validador/rut.util';

type ListParams = { centroId?: number; rol?: string; search?: string; page: number; limit: number; };

@Injectable()
export class TrabajadoresService {
  constructor(private prisma: PrismaService) {}

  // ====== LISTAR (filtros + paginación) ======
  async list(params: ListParams) {
    const { centroId, rol, search, page = 1, limit = 10 } = params;

    const where: any = {};
    if (centroId) where.centroId = centroId;
    if (rol) where.rol = rol;
    if (search && search.trim() !== '') {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { rut: { contains: search, mode: 'insensitive' } },
        { correo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.trabajadorEduc.findMany({
        where,
        orderBy: { nombre: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { centro: { select: { id: true, nombre: true } } },
      }),
      this.prisma.trabajadorEduc.count({ where }),
    ]);

    return { items, page, limit, total, pages: Math.ceil(total / limit) };
  }

  // ====== CREATE ======

  async create(dto: CreateTrabajadorDto) {
    // validar que el centro exista
    const centro = await this.prisma.centroEducativo.findUnique({ where: { id: dto.centroId } });
    if (!centro) throw new NotFoundException('Centro educativo no encontrado');

    const rutNormalizado = this.buildRut(dto.rut, dto.centroId);

    return this.prisma.trabajadorEduc.create({
      data: {
        rut: rutNormalizado,
        nombre: dto.nombre,
        rol: dto.rol,
        correo: dto.correo,
        telefono: dto.telefono,
        centroId: dto.centroId,
      },
    });
  }

  // ====== READ ONE ======
  async findOne(id: number) {
    const t = await this.prisma.trabajadorEduc.findUnique({
      where: { id },
      include: { centro: { select: { id: true, nombre: true } } },
    });
    if (!t) throw new NotFoundException('Trabajador no encontrado');
    return t;
  }

  // ====== UPDATE ======
  async update(id: number, dto: UpdateTrabajadorDto) {
    // Si cambia el centro, validar que exista
    if (dto.centroId !== undefined) {
      const centro = await this.prisma.centroEducativo.findUnique({ where: { id: dto.centroId } });
      if (!centro) throw new NotFoundException('Centro educativo no encontrado');
    }

    // Construir data solo con campos presentes
    const data: any = {};

    if (dto.rut !== undefined) {
      // Normalizar RUT antes de actualizar
      const trimmed = (dto.rut ?? '').toString().trim();
      if (trimmed !== '') {
        data.rut = normalizeRut(trimmed);
      }
    }
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.rol !== undefined) data.rol = dto.rol;
    if (dto.correo !== undefined) data.correo = dto.correo;
    if (dto.telefono !== undefined) data.telefono = dto.telefono;
    if (dto.centroId !== undefined) data.centroId = dto.centroId;

    try {
      return await this.prisma.trabajadorEduc.update({
        where: { id },
        data,
      });
    } catch {
      throw new NotFoundException('Trabajador no encontrado');
    }
  }


  // ====== DELETE ======
  async remove(id: number) {
    try {
      return await this.prisma.trabajadorEduc.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Trabajador no encontrado');
    }
  }

  private buildRut(rut: string | undefined, centroId: number): string {
    const trimmed = (rut ?? '').toString().trim();
    if (trimmed !== '') return normalizeRut(trimmed);

    // Genera un RUT temporal corto para cumplir con el campo único
    const centroPart = String(centroId).slice(-4);
    const timePart = Date.now().toString(36).slice(-6);
    return `TMP-${centroPart}-${timePart}`.toUpperCase();
  }
}
