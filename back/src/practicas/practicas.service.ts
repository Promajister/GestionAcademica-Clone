import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePracticaDto, EstadoPractica } from './dto/crear-practica.dto';
import { Prisma } from '@prisma/client';
import { Subject } from 'rxjs';
import { ConsultasJefaturaDto } from './dto/consultar-jefatura.dto';


@Injectable()
export class PracticasService {
  constructor(private readonly prisma: PrismaService) {}

  private static overlap(aStart: Date, aEnd: Date | null, bStart: Date, bEnd: Date | null): boolean {
    const aEndOrMax = aEnd ?? new Date(8640000000000000); // max date
    const bEndOrMax = bEnd ?? new Date(8640000000000000);
    return aStart <= bEndOrMax && aEndOrMax >= bStart;
  }
    private readonly changes$ = new Subject<any>();

    get stream$() {
        return this.changes$.asObservable();
    }

    private notifyChange(event: 'created'|'updated'|'deleted', payload: any) {
        this.changes$.next({ type: `practice.${event}`, at: new Date().toISOString(), payload });
    }


  async create(dto: CreatePracticaDto) {
    const estado = dto.estado ?? EstadoPractica.EN_CURSO;
    const start = new Date(dto.fecha_inicio);
    const end = dto.fecha_termino ? new Date(dto.fecha_termino) : null;

    if (isNaN(start.getTime()) || (end && isNaN(end.getTime()))) {
      throw new BadRequestException('Debe completar todos los campos requeridos.');
    }
    if (end && end < start) {
      throw new BadRequestException('Debe completar todos los campos requeridos.');
    }

    // normalizar IDs de colaboradores/tutores (uno o varios)
    const colaboradorIds = Array.isArray(dto.colaboradorIds)
      ? Array.from(new Set(dto.colaboradorIds))
      : dto.colaboradorId !== undefined
      ? [dto.colaboradorId]
      : [];
    const tutorIds = Array.isArray(dto.tutorIds)
      ? Array.from(new Set(dto.tutorIds))
      : dto.tutorId !== undefined
      ? [dto.tutorId]
      : [];

    // roles por tutor
    const rolesInput = Array.isArray((dto as any).tutorRoles)
      ? ((dto as any).tutorRoles as ('Supervisor' | 'Tallerista')[])
      : (dto as any).tutorRole
      ? [((dto as any).tutorRole as 'Supervisor' | 'Tallerista')]
      : [];

    if (colaboradorIds.length === 0 || tutorIds.length === 0) {
      throw new BadRequestException('Debe indicar al menos un colaborador y un tutor.');
    }
    if (rolesInput.length && rolesInput.length !== tutorIds.length) {
      throw new BadRequestException('La cantidad de tutorRoles debe coincidir con tutorIds.');
    }

    const [estudiante, centro, colaboradores, tutores] = await Promise.all([
      this.prisma.estudiante.findUnique({ where: { rut: dto.estudianteRut } }),
      this.prisma.centroEducativo.findUnique({ where: { id: dto.centroId } }),
      this.prisma.colaborador.findMany({ where: { id: { in: colaboradorIds } } }),
      this.prisma.tutor.findMany({ where: { id: { in: tutorIds } } }),
    ]);
    if (!estudiante || !centro) {
      throw new BadRequestException('Debe completar todos los campos requeridos.');
    }
    if (colaboradores.length !== colaboradorIds.length) {
      throw new BadRequestException('Uno o más colaboradores no existen.');
    }
    if (tutores.length !== tutorIds.length) {
      throw new BadRequestException('Uno o más tutores no existen.');
    }

    const posiblesActivas = await this.prisma.practica.findMany({
      where: {
        estudianteRut: dto.estudianteRut,
        estado: { in: [EstadoPractica.EN_CURSO] as any },
      },
      select: { id: true, fecha_inicio: true, fecha_termino: true },
    });

    // Si ya hay una práctica activa en estado, se bloquea
    if (posiblesActivas.length > 0 && (estado === EstadoPractica.EN_CURSO)) {
      throw new BadRequestException('No se puede asignar más de una práctica activa simultáneamente para este estudiante.');
    }

    // Se evita solape de periodos con cualquier práctica activa existente 
    for (const p of posiblesActivas) {
      if (PracticasService.overlap(new Date(p.fecha_inicio), p.fecha_termino, start, end)) {
        throw new BadRequestException('No se puede asignar más de una práctica activa simultáneamente para este estudiante.');
      }
    }

    // Crear práctica
    const created = await this.prisma.practica.create({
      data: {
        estudianteRut: dto.estudianteRut,
        centroId: dto.centroId,
        fecha_inicio: start,
        fecha_termino: end,
        tipo: dto.tipo ?? null,
        estado: estado as any,
        practicaColaboradores: {
          create: colaboradorIds.map((id) => ({ colaborador: { connect: { id } } })),
        },
        practicaTutores: {
          create: tutorIds.map((id, idx) => ({
            tutor: { connect: { id } },
            rol: ((rolesInput[idx] ?? 'Supervisor') as any),
          })),
        },
      },
      include: {
        estudiante: true,
        centro: true,
        practicaColaboradores: { include: { colaborador: true } },
        practicaTutores: { include: { tutor: true } },
      },
    });

    this.notifyChange('created', created);

    return {
      message: 'Práctica asignada exitosamente.',
      data: created,
    };
    
  }

  // Listado para “Gestión de prácticas” 
  async list(params: { estado?: EstadoPractica; estudianteRut?: string }) {
    return this.prisma.practica.findMany({
      where: {
        estado: params.estado as any,
        estudianteRut: params.estudianteRut,
      },
      orderBy: { fecha_inicio: 'desc' },
      include: {
        estudiante: true,
        centro: true,
        practicaColaboradores: { include: { colaborador: true } },
        practicaTutores: { include: { tutor: true } },
      },
    });
  }

  // Vista para Jefatura 
    async listForJefatura(q: ConsultasJefaturaDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const fromDate = q.from ? new Date(q.from) : undefined;
    const toDate   = q.to   ? new Date(q.to)   : undefined;
    if ((q.from && isNaN(fromDate!.getTime())) || (q.to && isNaN(toDate!.getTime()))) {
        throw new BadRequestException('Rango de fechas inválido');
    }

    const searchFilter = q.q
        ? {
            OR: [
            { estudiante:  { nombre: { contains: q.q, mode: 'insensitive' } } },
            { centro:      { nombre: { contains: q.q, mode: 'insensitive' } } },
            { practicaColaboradores: { some: { colaborador: { nombre: { contains: q.q, mode: 'insensitive' } } } } },
            { tipo:        { contains: q.q, mode: 'insensitive' } },
            ],
        }
        : {};

    // @ts-ignore - Prisma types not generated, run: npx prisma generate
    const where: Prisma.PracticaWhereInput = {
        ...(q.estado ? { estado: q.estado as any } : {}),
        ...(q.centroId ? { centroId: q.centroId } : {}),
        ...(q.colaboradorId ? { practicaColaboradores: { some: { colaboradorId: q.colaboradorId } } } : {}),
        ...(fromDate ? { fecha_inicio: { gte: fromDate } } : {}),
        ...(toDate   ? { fecha_inicio: { ...(fromDate ? { gte: fromDate } : {}), lte: toDate } } : {}),
        ...searchFilter,
    };

    // @ts-ignore - Prisma types not generated, run: npx prisma generate
    const orderBy: Prisma.PracticaOrderByWithRelationInput =
        q.sortBy ? { [q.sortBy]: q.sortOrder ?? 'desc' } : { fecha_inicio: 'desc' };

    const [total, items] = await this.prisma.$transaction([
        this.prisma.practica.count({ where }),
        this.prisma.practica.findMany({
        where, orderBy, skip, take,
        include: {
            estudiante: { select: { rut: true, nombre: true } },
            centro:     { select: { id: true, nombre: true, tipo: true } },
            practicaColaboradores: { select: { colaborador: { select: { id: true, nombre: true } } } },
        },
        }),
    ]);

    return {
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        items,
    };
    }

  async findOne(id: number) {
    const p = await this.prisma.practica.findUnique({
      where: { id },
      include: {
        estudiante: true,
        centro: true,
        practicaColaboradores: { include: { colaborador: true } },
        practicaTutores: { include: { tutor: true } },
        observaciones: {
          orderBy: { fecha: 'desc' },
        },
      },
    });
    if (!p) throw new NotFoundException('Práctica no encontrada');
    return p;
  }

  async updateEstado(id: number, estado: EstadoPractica) {
    const practica = await this.prisma.practica.findUnique({
      where: { id },
    });
    
    if (!practica) {
      throw new NotFoundException('Práctica no encontrada');
    }

    const updated = await this.prisma.practica.update({
      where: { id },
      data: { estado: estado as any },
      include: {
        estudiante: true,
        centro: true,
        practicaColaboradores: { include: { colaborador: true } },
        practicaTutores: { include: { tutor: true } },
      },
    });

    this.notifyChange('updated', updated);

    return {
      message: 'Estado de la práctica actualizado exitosamente.',
      data: updated,
    };
  }
}
