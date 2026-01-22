import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Estudiante } from '@prisma/client';
import dayjs from 'dayjs';
import * as puppeteer from 'puppeteer';

import { PrismaService } from '../../prisma/prisma.service';
import { HistorialQueryDto } from './dto/historial-query.dto';

@Injectable()
export class HistorialService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureBaseEvent(estudiante: Estudiante) {
    const existing = await this.prisma.historialEvento.count({
      where: { estudianteRut: estudiante.rut },
    });

    if (existing > 0) return;

    const ingresoYear = estudiante.anio_ingreso
      ? dayjs(`${estudiante.anio_ingreso}-01-01`).startOf('year').toDate()
      : null;

    await this.prisma.historialEvento.create({
      data: {
        estudianteRut: estudiante.rut,
        tipo: 'registro',
        titulo: 'Registro inicial del estudiante',
        descripcion: `Se genera el historial base para ${estudiante.nombre}.`,
        fecha: ingresoYear ?? new Date(),
        responsable: 'Sistema',
      },
    });
  }

  private buildFilters(q: HistorialQueryDto): Prisma.HistorialEventoWhereInput {
    return {
      ...(q.tipo ? { tipo: q.tipo } : {}),
      ...(q.desde || q.hasta
        ? {
            fecha: {
              ...(q.desde ? { gte: new Date(q.desde) } : {}),
              ...(q.hasta ? { lte: new Date(q.hasta) } : {}),
            },
          }
        : {}),
    };
  }

  async list(rut: string, q: HistorialQueryDto) {
    const estudiante = await this.prisma.estudiante.findUnique({
      where: { rut },
    });
    if (!estudiante) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    await this.ensureBaseEvent(estudiante);

    const filtros = this.buildFilters(q);

    return this.prisma.historialEvento.findMany({
      where: { estudianteRut: rut, ...filtros },
      orderBy: { fecha: 'asc' },
      take: q.limit ?? 50,
    });
  }

  async exportPdf(rut: string, q: HistorialQueryDto) {
    const estudiante = await this.prisma.estudiante.findUnique({
      where: { rut },
    });
    if (!estudiante) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    const eventos = await this.list(rut, q);

    if (q.format && q.format !== 'pdf') {
      throw new BadRequestException('Solo se soporta format=pdf');
    }

    const html = this.buildHtml(estudiante, eventos);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '32px',
        right: '28px',
        bottom: '36px',
        left: '28px',
      },
    });
    await browser.close();

    return pdf;
  }

  private buildHtml(estudiante: Estudiante, eventos: any[]) {
    const rows = eventos
      .map(
        (ev) => `
        <div class="item">
            <div class="item__fecha">${dayjs(ev.fecha).format('DD/MM/YYYY')}</div>
          <div class="item__body">
            <div class="item__tipo">${ev.tipo || 'Evento'}</div>
            ${
              ev.titulo
                ? `<div class="item__titulo">${ev.titulo}</div>`
                : ''
            }
            ${
              ev.descripcion
                ? `<div class="item__descripcion">${ev.descripcion}</div>`
                : ''
            }
            ${
              ev.responsable
                ? `<div class="item__responsable">Responsable: ${ev.responsable}</div>`
                : ''
            }
          </div>
        </div>
      `,
      )
      .join('');

    return `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              margin: 0;
              padding: 0;
              color: #1f2937;
              background: #f5f7fb;
            }
            .page {
              padding: 28px;
            }
            .header {
              background: linear-gradient(135deg, #21409a, #1a73e8);
              color: #fff;
              border-radius: 12px;
              padding: 18px 20px;
              box-shadow: 0 8px 18px rgba(33, 64, 154, 0.25);
            }
            .title {
              margin: 0;
              font-size: 20px;
              letter-spacing: 0.2px;
            }
            .subtitle {
              margin: 4px 0 0;
              font-size: 13px;
              opacity: 0.9;
            }
            .student-card {
              background: #fff;
              padding: 14px 16px;
              border-radius: 10px;
              margin-top: 12px;
              border: 1px solid #e5e7eb;
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
              gap: 8px 16px;
            }
            .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; }
            .value { font-size: 13px; color: #111827; font-weight: 600; }
            .timeline {
              margin-top: 18px;
              background: #fff;
              padding: 16px;
              border-radius: 12px;
              border: 1px solid #e5e7eb;
            }
            .item {
              display: grid;
              grid-template-columns: 140px 1fr;
              gap: 12px;
              padding: 12px 0;
              border-bottom: 1px solid #f1f5f9;
            }
            .item:last-child { border-bottom: none; }
            .item__fecha {
              font-size: 12px;
              color: #1d4ed8;
              font-weight: 700;
              letter-spacing: 0.2px;
            }
            .item__tipo {
              display: inline-block;
              background: #e0e7ff;
              color: #1e3a8a;
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.2px;
            }
            .item__titulo {
              font-size: 14px;
              margin: 6px 0 2px;
              font-weight: 700;
            }
            .item__descripcion {
              font-size: 13px;
              color: #374151;
              line-height: 1.45;
              margin-top: 4px;
              white-space: pre-line;
            }
            .item__responsable {
              font-size: 12px;
              color: #6b7280;
              margin-top: 6px;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <h1 class="title">Historial del estudiante</h1>
              <div class="subtitle">Registro de prácticas, actividades y evaluaciones</div>
            </div>
            <div class="student-card">
              <div>
                <div class="label">Nombre</div>
                <div class="value">${estudiante.nombre ?? '-'}</div>
              </div>
              <div>
                <div class="label">RUT</div>
                <div class="value">${estudiante.rut}</div>
              </div>
              <div>
                <div class="label">Plan</div>
                <div class="value">${estudiante.plan ?? '-'}</div>
              </div>
              <div>
                <div class="label">Ingreso</div>
                <div class="value">${estudiante.anio_ingreso ? String(estudiante.anio_ingreso) : '-'}</div>
              </div>
              <div>
                <div class="label">Correo</div>
                <div class="value">${estudiante.email ?? '-'}</div>
              </div>
              <div>
                <div class="label">Teléfono</div>
                <div class="value">${estudiante.fono ?? '-'}</div>
              </div>
            </div>
            <div class="timeline">
              ${rows || '<div style="color:#6b7280;font-size:13px;">Sin eventos registrados.</div>'}
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
