import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { QueryEstudianteDto } from './dto/query-estudiante.dto';
import { Workbook } from 'exceljs';

@Injectable()
export class EstudianteService {
  constructor(private prisma: PrismaService) {}

  /* ============================
     LISTADO
  ============================ */
  async findAll(q: QueryEstudianteDto) {
    const where: Prisma.EstudianteWhereInput = {
      ...(q.nombre ? { nombre: { contains: q.nombre } } : {}),
      ...(q.carrera ? { plan: { contains: q.carrera } } : {}),
      ...(q.estadoPractica
        ? { practicas: { some: { estado: q.estadoPractica as any } } }
        : {}),
    };

    const estudiantes = await this.prisma.estudiante.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: {
        practicas: {
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
          select: {
            estado: true,
            fecha_inicio: true,
            fecha_termino: true,
          },
        },
      },
    });

    return estudiantes.map((e) => ({
      rut: e.rut,
      nombre: e.nombre,
      plan: e.plan,
      email: e.email,
      fono: e.fono,
      estadoPractica: e.practicas[0]?.estado ?? null,
      ultimaPractica: e.practicas[0]
        ? {
            fecha_inicio: e.practicas[0].fecha_inicio,
            fecha_termino: e.practicas[0].fecha_termino,
          }
        : null,
    }));
  }

  /* ============================
     DETALLE
  ============================ */
  async findOne(rut: string) {
    const normalizedRut = this.normalizeRut(rut);

    const estudiante = await this.prisma.estudiante.findFirst({
      where: {
        OR: [{ rut }, { rut: normalizedRut }],
      },
      include: {
        practicas: {
          orderBy: { fecha_inicio: 'desc' },
          include: {
            practicaColaboradores: {
              include: { colaborador: true },
            },
            practicaTutores: {
              include: { tutor: true },
            },
          },
        },
      },
    });

    if (!estudiante) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    let actividades: any[] = [];
    try {
      actividades = await this.prisma.actividad.findMany({
        where: {
          OR: [
            { estudiantes: { contains: rut } },
            { estudiantes: { contains: estudiante.nombre } },
          ],
        },
        orderBy: { fecha: 'desc' },
        select: {
          id: true,
          estudiantes: true,
          fecha: true,
          horario: true,
          lugar: true,
          archivo_adjunto: true,
        },
      });
    } catch (err: any) {
      if (err?.code !== 'P2022') throw err;
    }

    return { ...estudiante, actividades };
  }

  /* ============================
     IMPORTACIÓN XLSX (SOLUCIONADA)
  ============================ */
  async importFromXlsx(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo vacío o no recibido');
    }

    const workbook = new Workbook();

try {
  const rawBuffer = Buffer.from(file.buffer); // Buffer global de Node
  await workbook.xlsx.load(rawBuffer as any); // cast mínimo por typings de exceljs
} catch {
  throw new BadRequestException(
    'No se pudo leer el XLSX. Verifique el archivo.',
  );
}

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('El XLSX no tiene hojas');
    }

    const headerRow = sheet.getRow(1);
    const headers: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      const key = String(cell.value ?? '')
        .trim()
        .toLowerCase();
      if (key) headers[key] = colNumber;
    });

    const required = ['rut', 'nombre'];
    const missing = required.filter((k) => !headers[k]);
    if (missing.length) {
      throw new BadRequestException(
        `Faltan columnas obligatorias: ${missing.join(', ')}`,
      );
    }

    const summary = {
      inserted: 0,
      updated: 0,
      total: 0,
      errors: [] as { row: number; rut?: string; message: string }[],
    };

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);

      const rutRaw = this.getCellString(row, headers, 'rut');
      const nombre = this.getCellString(row, headers, 'nombre');
      if (!rutRaw && !nombre) continue;

      const rut = this.normalizeRut(rutRaw);
      if (!rut || !nombre) {
        summary.errors.push({
          row: i,
          rut: rutRaw,
          message: 'Rut y nombre son obligatorios',
        });
        continue;
      }

      const data: Prisma.EstudianteUncheckedCreateInput = {
        rut,
        nombre,
        plan: this.getCellString(row, headers, 'plan'),
        email: this.getCellString(row, headers, 'email'),
        fono: this.getCellNumber(row, headers, 'fono'),
      };

      try {
        const existing = await this.prisma.estudiante.findFirst({
          where: { rut },
        });

        if (existing) {
          await this.prisma.estudiante.update({
            where: { rut },
            data: { ...data, rut: undefined },
          });
          summary.updated++;
        } else {
          await this.prisma.estudiante.create({ data });
          summary.inserted++;
        }
      } catch (err: any) {
        summary.errors.push({
          row: i,
          rut: rutRaw,
          message: err?.message ?? 'Error al guardar',
        });
      }

      summary.total++;
    }

    return summary;
  }

  /* ============================
     HELPERS
  ============================ */
  private normalizeRut(raw: string): string {
    return raw?.replace(/[.\s-]/g, '').toUpperCase() ?? '';
  }

  private getCellString(
    row: import('exceljs').Row,
    headers: Record<string, number>,
    key: string,
  ): string {
    const col = headers[key];
    if (!col) return '';
    const cell = row.getCell(col);
    const value: any = cell?.text ?? cell?.result ?? cell?.value;
    return value ? String(value).trim() : '';
  }

  private getCellNumber(
    row: import('exceljs').Row,
    headers: Record<string, number>,
    key: string,
  ): number | null {
    const raw = this.getCellString(row, headers, key);
    if (!raw) return null;
    const normalized = raw.replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
}
