import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class CarrerasService {
  constructor(private prisma: PrismaService) {}

  // Carreras con sus planes vigentes (selector del mantenedor de asignaturas)
  findAll() {
    return this.prisma.carrera.findMany({
      include: {
        planes: { where: { vigente: true }, orderBy: { anio: 'desc' } },
      },
      orderBy: { codigo: 'asc' },
    });
  }
}
