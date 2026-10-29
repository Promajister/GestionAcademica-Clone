import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class CarrerasService {
  constructor(private prisma: PrismaService) {}

  // Carreras con sus planes (selector del mantenedor de asignaturas)
  async findAll() {
    const carreras = await this.prisma.carrera.findMany({
      include: {
        planes: {
          orderBy: [{ year: 'desc' }, { version: 'desc' }],
        },
      },
      orderBy: { codigo: 'asc' },
    });

    return carreras.map((c) => ({
      id_carrera: c.codigo,
      codigo: c.codigo,
      nombre: c.nombre,
      planes: c.planes.map((p) => ({
        id_plan: p.id_plan,
        year: p.year,
        version: p.version,
        codigo_carrera: p.codigo_carrera,
        nombre: `Plan ${p.year} v${p.version}`,
      })),
    }));
  }
}
