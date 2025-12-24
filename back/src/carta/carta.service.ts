import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const TIPOS_PRACTICA = [
  'Apoyo a la Docencia I',
  'Apoyo a la Docencia II',
  'Apoyo a la Docencia III',
  'Apoyo a la Docencia IV',
  'Práctica Profesional',
] as const;

@Injectable()
export class CartaService {
  constructor(private prisma: PrismaService) {}

  // Catálogo para el front
  getTiposPractica() {
    return TIPOS_PRACTICA;
  }

  // ==== Búsquedas (with typed where) ====
  getCentros(q?: string) {
    const where = q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' as const } },
            { comuna: { contains: q, mode: 'insensitive' as const } },
            { region: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    return this.prisma.centroEducativo.findMany({
      where,
      orderBy: { nombre: 'asc' },
      take: 50,
    });
  }

  getEstudiantes(q?: string) {
    const where = q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' as const } },
            { rut: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    return this.prisma.estudiante.findMany({
      where,
      orderBy: { nombre: 'asc' },
      take: 50,
    });
  }

  getSupervisores(q?: string) {
    const where = q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' as const } },
            { rut: { contains: q, mode: 'insensitive' as const } },
            { correo: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    return this.prisma.colaborador.findMany({
      where,
      orderBy: { nombre: 'asc' },
      take: 50,
    });
  }

  // ==== Crear carta ====
  async crearCarta(dto: {
    tipoPractica: string;
    centroId: number;
    estudiantesIds: (string | number)[]; // acepta RUTs (string) o IDs numéricos
    supervisorId: number;
    periodoInicio: string; // yyyy-mm-dd
    periodoFin: string; // yyyy-mm-dd
  }) {
    if (!TIPOS_PRACTICA.includes(dto.tipoPractica as any)) {
      throw new Error('Tipo de práctica no válido');
    }

    // folio sencillo
    const count = await this.prisma.cartaSolicitud.count();
    const folio = `${count + 1}`;

    // 1) Crear registro base de carta (para PDF/folio)
    const carta = await this.prisma.cartaSolicitud.create({
      data: {
        numero_folio: folio,
        fecha: new Date(),
        direccion_emisor: 'Departamento de Prácticas - UTA',
        url_archivo: null,
      },
      select: {
        id: true,
        numero_folio: true,
        fecha: true,
      },
    });

    return {
      id: carta.id,
      folio: carta.numero_folio,
      fecha: carta.fecha,
    };
  }
}
