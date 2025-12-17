import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateObservacionDto } from './dto/crear-observacion.dto';
import { UpdateObservacionDto } from './dto/actualizar-observacion.dto';

@Injectable()
export class ObservacionesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una nueva observación
   * Solo permitido para rol 'practicas' (coordinadora de prácticas)
   */
  async create(dto: CreateObservacionDto, userRole?: string) {
    // Verificar permisos: solo coordinadora de prácticas puede crear
    if (userRole && userRole !== 'practicas') {
      throw new ForbiddenException('No tiene permisos para crear observaciones');
    }

    // Verificar que la práctica existe
    const practica = await this.prisma.practica.findUnique({
      where: { id: dto.practicaId },
    });

    if (!practica) {
      throw new NotFoundException('Práctica no encontrada');
    }

    const observacion = await this.prisma.observacion.create({
      data: {
        practicaId: dto.practicaId,
        descripcion: dto.descripcion,
      },
      include: {
        practica: {
          select: {
            id: true,
            estudiante: {
              select: {
                rut: true,
                nombre: true,
              },
            },
          },
        },
      },
    });

    return {
      message: 'Observación creada exitosamente',
      data: observacion,
    };
  }

  /**
   * Obtiene todas las observaciones de una práctica
   * Permitido para todos los roles (practicas y jefatura)
   */
  async findByPractica(practicaId: number) {
    const practica = await this.prisma.practica.findUnique({
      where: { id: practicaId },
    });

    if (!practica) {
      throw new NotFoundException('Práctica no encontrada');
    }

    const observaciones = await this.prisma.observacion.findMany({
      where: { practicaId },
      orderBy: { fecha: 'desc' },
    });

    return observaciones;
  }

  /**
   * Actualiza una observación
   * Solo permitido para rol 'practicas' (coordinadora de prácticas)
   */
  async update(id: number, dto: UpdateObservacionDto, userRole?: string) {
    // Verificar permisos: solo coordinadora de prácticas puede editar
    if (userRole && userRole !== 'practicas') {
      throw new ForbiddenException('No tiene permisos para editar observaciones');
    }

    const observacion = await this.prisma.observacion.findUnique({
      where: { id },
    });

    if (!observacion) {
      throw new NotFoundException('Observación no encontrada');
    }

    const updated = await this.prisma.observacion.update({
      where: { id },
      data: {
        descripcion: dto.descripcion,
      },
    });

    return {
      message: 'Observación actualizada exitosamente',
      data: updated,
    };
  }

  /**
   * Elimina una observación
   * Solo permitido para rol 'practicas' (coordinadora de prácticas)
   */
  async remove(id: number, userRole?: string) {
    // Verificar permisos: solo coordinadora de prácticas puede eliminar
    if (userRole && userRole !== 'practicas') {
      throw new ForbiddenException('No tiene permisos para eliminar observaciones');
    }

    const observacion = await this.prisma.observacion.findUnique({
      where: { id },
    });

    if (!observacion) {
      throw new NotFoundException('Observación no encontrada');
    }

    await this.prisma.observacion.delete({
      where: { id },
    });

    return {
      message: 'Observación eliminada exitosamente',
    };
  }
}

