import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { QueryEstudianteDto } from './dto/query-estudiante.dto';
import dayjs from 'dayjs';
import { Workbook } from 'exceljs';

@Injectable()
export class EstudianteService {
  constructor(private prisma: PrismaService) {}

  /* ============================
     LISTADO
  ============================ */
  async findAll(q: QueryEstudianteDto) {
    const nombreTerm = q.nombre?.trim();
    const rutRaw = q.rut?.trim();
    const rutTerm = rutRaw ? this.normalizeRut(rutRaw) : '';
    const rutFromNombre = nombreTerm ? this.normalizeRut(nombreTerm) : '';

    const practicaFilter: Prisma.PracticaWhereInput = {
      ...(q.estadoPractica ? { estado: q.estadoPractica as any } : {}),
      ...(q.tipoPractica ? { tipo: { contains: q.tipoPractica } } : {}),
      ...(q.anio || q.semestre
        ? (() => {
            const year = q.anio ?? dayjs().year();
            const sem = q.semestre;
            const start = sem === 2 ? dayjs(`${year}-07-01`) : dayjs(`${year}-01-01`);
            const end =
              sem === 2
                ? dayjs(`${year}-12-31`).endOf('day')
                : dayjs(`${year}-06-30`).endOf('day');
            return { fecha_inicio: { gte: start.toDate(), lte: end.toDate() } };
          })()
        : q.anio
        ? {
            fecha_inicio: {
              gte: dayjs(`${q.anio}-01-01`).toDate(),
              lte: dayjs(`${q.anio}-12-31`).endOf('day').toDate(),
            },
          }
        : {}),
    };

    const orFilters: Prisma.EstudianteWhereInput[] = [];

    if (nombreTerm) {
      orFilters.push({ nombre: { contains: nombreTerm } });
      if (/[0-9kK]/.test(nombreTerm)) {
        orFilters.push({ rut: { contains: nombreTerm } });
      }
      if (rutFromNombre) {
        orFilters.push({ rut: { contains: rutFromNombre } });
      }
    }

    if (rutRaw) {
      orFilters.push({ rut: { contains: rutRaw } });
    }
    if (rutTerm) {
      orFilters.push({ rut: { contains: rutTerm } });
    }

    const where: Prisma.EstudianteWhereInput = {
      ...(orFilters.length ? { OR: orFilters } : {}),
      ...(q.carrera ? { plan: { contains: q.carrera } } : {}),
      ...(q.anioIngreso ? { anio_ingreso: q.anioIngreso } : {}),
      ...(Object.keys(practicaFilter).length
        ? { practicas: { some: practicaFilter } }
        : q.estadoPractica
        ? { practicas: { some: { estado: q.estadoPractica as any } } }
        : {}),
    };

    const page = q.page && q.page > 0 ? q.page : 1;
    const limit = q.limit && q.limit > 0 ? q.limit : undefined;

    const query = Prisma.validator<Prisma.EstudianteFindManyArgs>()({
      where,
      orderBy: { nombre: 'asc' },
      include: {
        practicas: {
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
          select: { estado: true, fecha_inicio: true, fecha_termino: true, tipo: true },
        },
      },
      ...(limit ? { skip: (page - 1) * limit, take: limit } : {}),
    });

    const estudiantes = await this.prisma.estudiante.findMany(query);

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
            tipo: e.practicas[0].tipo,
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
    centro: {
      select: {
        id: true,
        nombre: true,
        tipo: true,
        region: true,
        comuna: true,
        direccion: true,
        telefono: true,
        correo: true,
      },
    },
    practicaColaboradores: { include: { colaborador: true } },
    practicaTutores: { include: { tutor: true } },
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
          nombre_actividad: true,
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
    const headerAliases: Record<string, string> = {
      ano_ingreso: 'anio_ingreso',
      ano_nacimiento: 'anio_nacimiento',
      ano_nacimento: 'anio_nacimiento',
      anio_nacimento: 'anio_nacimiento',
      sist_ingreso: 'sistema_ingreso',
      ptj_ponderado: 'puntaje_ponderado',
      ptj_psu: 'puntaje_psu',
      nro_inscripciones: 'numero_inscripciones',
      e_mail: 'email',
      correo: 'email',
    };
    headerRow.eachCell((cell, colNumber) => {
      const key = String(cell.value ?? '').trim().toLowerCase();
      let normalized = key
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/__+/g, '_')
        .replace(/\bano/g, 'anio');

      normalized = headerAliases[normalized] ?? normalized;
      if (normalized) headers[normalized] = colNumber;
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
        genero: this.getCellString(row, headers, 'genero'),
        anio_nacimiento: this.getCellDate(row, headers, 'anio_nacimiento'),
        anio_ingreso: this.getCellInt(row, headers, 'anio_ingreso'),
        plan: this.getCellString(row, headers, 'plan'),
        avance: this.getCellFloat(row, headers, 'avance'),
        puntaje_ponderado: this.getCellFloat(
          row,
          headers,
          'puntaje_ponderado',
        ),
        puntaje_psu: this.getCellFloat(row, headers, 'puntaje_psu'),
        promedio: this.getCellFloat(row, headers, 'promedio'),
        email: this.getCellString(row, headers, 'email'),
        fono: this.getCellInt(row, headers, 'fono'),
        direccion: this.getCellString(row, headers, 'direccion'),
        sistema_ingreso: this.getCellString(row, headers, 'sistema_ingreso'),
        numero_inscripciones: this.getCellInt(
          row,
          headers,
          'numero_inscripciones',
        ),
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
    // Normalize to NFC so tildes/acentos se guarden correctamente en DB.
    return value ? String(value).trim().normalize('NFC') : '';
  }

  private getCellNumber(
    row: import('exceljs').Row,
    headers: Record<string, number>,
    key: string,
  ): number | null {
    return this.parseNumberString(this.getCellString(row, headers, key));
  }

  private getCellInt(
    row: import('exceljs').Row,
    headers: Record<string, number>,
    key: string,
  ): number | null {
    const n = this.parseNumberString(this.getCellString(row, headers, key));
    return Number.isFinite(n) ? Math.trunc(n as number) : null;
  }

  private getCellFloat(
    row: import('exceljs').Row,
    headers: Record<string, number>,
    key: string,
  ): number | null {
    const n = this.parseNumberString(this.getCellString(row, headers, key));
    return Number.isFinite(n) ? n : null;
  }

  private getCellDate(
    row: import('exceljs').Row,
    headers: Record<string, number>,
    key: string,
  ): Date | null {
    const col = headers[key];
    if (!col) return null;
    const cell = row.getCell(col);
    const value: any = cell?.value ?? cell?.text ?? cell?.result;

    if (value instanceof Date) return value;

    if (typeof value === 'number' && Number.isFinite(value)) {
      const year = Math.trunc(value);
      return new Date(year, 0, 1);
    }

    const text = String(value ?? '').trim();
    if (!text) return null;

    const parsedNumber = Number(text);
    if (Number.isFinite(parsedNumber)) {
      return new Date(Math.trunc(parsedNumber), 0, 1);
    }

    const parsedDate = new Date(text);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  private parseNumberString(raw: string): number | null {
    const trimmed = raw?.trim();
    if (!trimmed) return null;

    let candidate = trimmed.replace(/\s/g, '');

    // Formato 1.234,56 -> 1234.56
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(candidate)) {
      candidate = candidate.replace(/\./g, '').replace(',', '.');
    }
    // Formato 1,234.56 -> 1234.56
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(candidate)) {
      candidate = candidate.replace(/,/g, '');
    }
    // Formato simple: usa coma como decimal si existe; punto queda
    else {
      candidate = candidate.replace(',', '.');
    }

    const n = Number(candidate);
    return Number.isFinite(n) ? n : null;
  }
}
