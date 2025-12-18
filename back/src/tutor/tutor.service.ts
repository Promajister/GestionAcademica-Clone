import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateTutorDto } from './dto/create-tutor.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
import { QueryTutorDto } from './dto/query-tutor.dto';
import { normalizeRut } from 'src/validador/rut.util';

@Injectable()
export class TutorService {
  constructor(private prisma: PrismaService) {}

  // En el esquema actual no existen tablas Rol/TutorRol.
  // Tipos/roles ya no se manejan a nivel de Tutor.

  private normalizeCargos(dto: any) {
    const cargosList = Array.isArray(dto.cargos)
      ? (dto.cargos as string[])
          .filter((c) => !!c && c.trim())
          .map((c) => ({ cargo: c.trim() }))
      : dto.cargo && dto.cargo.trim()
      ? [{ cargo: dto.cargo.trim() }]
      : [];
    return cargosList;
  }

  async create(dto: CreateTutorDto) {
    const cargosList = this.normalizeCargos(dto as any);
    const { cargo, cargos, ...rest } = dto as any;

    return this.prisma.tutor.create({
      data: {
        ...rest,
        rut: normalizeRut(dto.rut),
        ...(cargosList.length ? { cargos: { create: cargosList } } : {}),
        // No hay relación roles en el esquema actual
      },
      include: {
        cargos: true,
      },
    });
  }

  async findAll(q: QueryTutorDto) {
    const { search, page = 1, limit = 10, orderBy = 'nombre', orderDir = 'asc' } = q;

    const where: any = {};
    if (search && search.trim()) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { rut: { contains: search, mode: 'insensitive' } },
        { correo: { contains: search, mode: 'insensitive' } },
      ];
    }
    // Sin relación roles/tipos en Tutor

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tutor.findMany({
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
      this.prisma.tutor.count({ where }),
    ]);

    const itemsMapped = items.map((it: any) => ({
      ...it,
      tipos: [],
      cargo: Array.isArray(it.cargos) && it.cargos.length ? it.cargos.map((c: any) => c.cargo).join(', ') : undefined,
    }));

    return {
      items: itemsMapped,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const t = await this.prisma.tutor.findUnique({
      where: { id },
      include: {
        cargos: { select: { id: true, cargo: true } },
      },
    });
    if (!t) throw new NotFoundException('Tutor no encontrado');
    const practicas = await this.prisma.practica.findMany({
      where: { practicaTutores: { some: { tutorId: id } } },
      select: {
        id: true,
        estado: true,
        fecha_inicio: true,
        fecha_termino: true,
        estudiante: { select: { rut: true, nombre: true } },
        centro: { select: { id: true, nombre: true, comuna: true } },
      },
    });
    return { ...t, practicas } as any;
  }

  async update(id: number, dto: UpdateTutorDto) {
    const cargosList = this.normalizeCargos(dto as any);
    const { cargo, cargos, ...rest } = dto as any;

    if (rest.rut !== undefined) {
      rest.rut = normalizeRut(rest.rut);
    }

    try {
      return await this.prisma.tutor.update({
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
      throw new NotFoundException('Tutor no encontrado');
    }
  }

  async remove(id: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Eliminar relaciones que pueden bloquear el borrado (FK)
        await tx.cargo.deleteMany({ where: { tutorId: id } });
        await tx.practicaTutor.deleteMany({ where: { tutorId: id } });

        // Finalmente eliminar el tutor
        return tx.tutor.delete({ where: { id } });
      });
    } catch {
      throw new NotFoundException('Tutor no encontrado');
    }
  }
}

 