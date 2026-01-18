import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActividadVinculacionService {
  constructor(private readonly prisma: PrismaService) {}

  async listarParaSelect(): Promise<{ id: number; nombre: string; fechaInicio?: Date }[]> {
    try {
      const actividades = await this.prisma.actividadVinculacion.findMany({
        select: {
          id: true,
          nombre: true,
          fechaInicio: true,
        },
        orderBy: { fechaInicio: 'desc' },
        take: 500,
      });

      return actividades.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        fechaInicio: a.fechaInicio ?? undefined,
      }));
    } catch (err) {
      console.error('ActividadVinculacionService.listarParaSelect error', err);
      throw new InternalServerErrorException('Error al listar actividades de vinculacion');
    }
  }
}
