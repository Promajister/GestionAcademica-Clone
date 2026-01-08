import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ReportesService, ReporteSatisfaccion } from '../../services/reportes.service';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const TIPOS_PRACTICA = [
  { label: 'PRÁCTICA DE APOYO A LA DOCENCIA I', value: 'Apoyo a la Docencia I' },
  { label: 'PRÁCTICA DE APOYO A LA DOCENCIA II', value: 'Apoyo a la Docencia II' },
  { label: 'PRÁCTICA DE APOYO A LA DOCENCIA III', value: 'Apoyo a la Docencia III' },
  { label: 'PRÁCTICA DE APOYO A LA DOCENCIA IV', value: 'Apoyo a la Docencia IV' },
  { label: 'PRÁCTICA PROFESIONAL DOCENTE', value: 'Práctica Profesional Docente' },
] as const;

type TipoPracticaValue = (typeof TIPOS_PRACTICA)[number]['value'];

@Component({
  standalone: true,
  selector: 'app-reportes-satisfaccion',
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatInputModule,
  ],
  templateUrl: './reportes-satisfaccion.component.html',
  styleUrls: ['./reportes-satisfaccion.component.scss'],
})
export class ReportesSatisfaccionComponent {
  private reportesService = inject(ReportesService);

  anio = new Date().getFullYear();
  semestre: 1 | 2 = 1;

  loading = false;
  error: string | null = null;

  data: ReporteSatisfaccion | null = null;

  tiposPractica = TIPOS_PRACTICA;
  tipo: TipoPracticaValue | null = null;

  hasSearched = false;
  filtersDirty = false;

  onFiltersChanged() {
    this.filtersDirty = true;
    this.error = null;
  }

  get canExport(): boolean {
    return !!this.data;
  }

  buscar() {
    this.loading = true;
    this.error = null;

    this.hasSearched = true;
    this.filtersDirty = false;

    this.data = null;

    this.reportesService
      .getSatisfaccion({
        anio: this.anio,
        semestre: this.semestre,
        tipo: this.tipo,
      })
      .subscribe({
        next: (res) => {
          this.data = res;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.data = null;
          this.error = 'No se pudo cargar el reporte de satisfacción.';
        },
      });
  }

  // ==========================
  // Helpers PDF (mismo estilo "estudiantes")
  // ==========================
  private async loadImageAsDataURLSafe(path: string): Promise<string | null> {
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  private drawPdfHeader(
    doc: jsPDF,
    opts: {
      title: string;
      subtitle: string;
      generatedText: string;
      logoLeft?: string | null;
      logoRight?: string | null;
    }
  ) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 52;
    const headerH = 92;

    const headerFill: [number, number, number] = [248, 250, 252];
    const line: [number, number, number] = [229, 231, 235];
    const text: [number, number, number] = [17, 24, 39];
    const muted: [number, number, number] = [100, 116, 139];

    doc.setFillColor(...headerFill);
    doc.rect(0, 0, pageWidth, headerH, 'F');

    const drawLogo = (dataUrl: string | null | undefined, x: number, y: number, w: number, h: number) => {
      if (!dataUrl) return;
      doc.addImage(dataUrl, 'PNG', x, y, w, h);
    };

    drawLogo(opts.logoLeft, margin, 16, 76, 56);
    drawLogo(opts.logoRight, pageWidth - margin - 76, 10, 76, 76);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...text);
    doc.text(opts.title, pageWidth / 2, 36, { align: 'center' as any });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text(opts.subtitle, pageWidth / 2, 56, { align: 'center' as any });

    doc.setFontSize(9);
    doc.text(opts.generatedText, pageWidth / 2, 72, { align: 'center' as any });

    doc.setDrawColor(...line);
    doc.setLineWidth(1);
    doc.line(margin, headerH, pageWidth - margin, headerH);
  }

  private drawPdfFooter(doc: jsPDF, page: number, totalPages: number) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 52;

    const line: [number, number, number] = [229, 231, 235];
    const muted: [number, number, number] = [100, 116, 139];

    const footerY = pageHeight - 34;

    doc.setDrawColor(...line);
    doc.setLineWidth(1);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...muted);

    doc.text('Gestión Académica • Reporte de satisfacción', margin, pageHeight - 18);
    doc.text(`Página ${page} / ${totalPages}`, pageWidth - margin, pageHeight - 18, { align: 'right' as any });
  }

  // ==========================
  // Export PDF (nuevo estilo)
  // ==========================
  async exportarPDF() {
    if (!this.data) return;

    const data = this.data;

    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 52;
    const headerH = 92;
    const top = headerH + 22;
    const bottom = 54;
    const contentW = pageWidth - margin * 2;

    const colors = {
      text: [17, 24, 39] as [number, number, number],
      muted: [100, 116, 139] as [number, number, number],
      line: [229, 231, 235] as [number, number, number],
      border: [209, 213, 219] as [number, number, number],
      tableHead: [241, 245, 249] as [number, number, number],
      cardFill: [248, 250, 252] as [number, number, number],
    };

    const safe = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));

    const [logoUta, logoFeh] = await Promise.all([
      this.loadImageAsDataURLSafe('assets/img/uta.png'),
      this.loadImageAsDataURLSafe('assets/img/feh.png'),
    ]);

    const now = new Date();
    const generatedText = `Generado: ${now.toLocaleString('es-CL')}`;

    const headerData = {
      title: 'REPORTE DE SATISFACCIÓN',
      subtitle: 'Indicadores de prácticas y encuestas',
      generatedText,
      logoLeft: logoUta,
      logoRight: logoFeh,
    };

    this.drawPdfHeader(doc, headerData);

    let y = top;

    const ensureSpace = (needed: number) => {
      if (y + needed <= pageHeight - bottom) return;
      doc.addPage();
      this.drawPdfHeader(doc, headerData);
      y = top;
    };

    // Card de parámetros
    ensureSpace(90);

    doc.setFillColor(...colors.cardFill);
    (doc as any).roundedRect(margin, y, contentW, 72, 12, 12, 'F');

    doc.setDrawColor(...colors.border);
    doc.setLineWidth(1);
    (doc as any).roundedRect(margin, y, contentW, 72, 12, 12, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...colors.text);
    doc.text('Parámetros del reporte', margin + 14, y + 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...colors.muted);

    doc.text(`Año: ${safe(data.anio)}`, margin + 14, y + 44);
    doc.text(`Semestre: ${safe(data.semestre)}`, margin + 160, y + 44);
    doc.text(`Tipo de practica: ${safe(data.tipo ?? 'Todo')}`, margin + 290, y + 44);

    y += 92;

    // Título sección
    ensureSpace(60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...colors.text);
    doc.text('RESUMEN DE INDICADORES', margin, y);

    y += 8;
    doc.setDrawColor(...colors.line);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + 260, y);
    y += 14;

    const rows: [string, string][] = [
      ['Prácticas (total)', safe(data.practicas.totalPracticas)],
      ['Estudiantes', safe(data.practicas.estudiantesUnicos)],

      ['Aprobadas', `${this.data.practicas.aprobadas} (${this.data.practicas.porcentajes.aprobadas}%)`],
      ['Reprobadas', `${this.data.practicas.reprobadas} (${this.data.practicas.porcentajes.reprobadas}%)`],
      ['En curso', `${this.data.practicas.enCurso} (${this.data.practicas.porcentajes.enCurso}%)`],

      ['Colaboradores', String(this.data.practicas.colaboradoresUnicos)],

      ['Encuestas Estudiantes (registradas)', safe(data.encuestasEstudiantes.totalEncuestas)],
      ['Alternativas respondidas (Estudiantes)', safe(data.encuestasEstudiantes.totalAlternativasRespondidas)],
      ['% Satisfacción Estudiantes', `${safe(data.encuestasEstudiantes.porcentajeSatisfaccion)}%`],

      ['Encuestas Colaboradores (registradas)', safe(data.encuestasColaboradores.totalEncuestas)],
      ['Alternativas respondidas (Colaboradores)', safe(data.encuestasColaboradores.totalAlternativasRespondidas)],
      ['% Satisfacción Colaboradores', `${safe(data.encuestasColaboradores.porcentajeSatisfaccion)}%`],
    ];

    autoTable(doc, {
      startY: y,
      head: [['Indicador', 'Valor']],
      body: rows,
      margin: { left: margin, right: margin, top, bottom },
      tableWidth: contentW,
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 6,
        textColor: colors.text as any,
        lineColor: colors.line as any,
        lineWidth: 0.8,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: colors.tableHead as any,
        textColor: colors.text as any,
        fontStyle: 'bold',
        lineColor: colors.border as any,
        lineWidth: 1,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] as any },
      columnStyles: {
        0: { cellWidth: Math.floor(contentW * 0.68) },
        1: { cellWidth: Math.floor(contentW * 0.32) },
      },
    });

    const totalPages = (doc as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      this.drawPdfHeader(doc, headerData);
      this.drawPdfFooter(doc, i, totalPages);
    }

    doc.save(`reporte_satisfaccion_${data.anio}_S${data.semestre}.pdf`);
  }

  // ==========================
  // Export Excel (se mantiene)
  // ==========================
  exportarExcel() {
    if (!this.data) return;

    const json = [
      { Indicador: 'Año', Valor: this.data.anio },
      { Indicador: 'Semestre', Valor: this.data.semestre },
      { Indicador: 'Tipo', Valor: this.data.tipo ?? 'Todo' },

      { Indicador: 'Prácticas (total)', Valor: this.data.practicas.totalPracticas },
      { Indicador: 'Estudiantes', Valor: this.data.practicas.estudiantesUnicos },

      { Indicador: 'Aprobadas', Valor: this.data.practicas.aprobadas },
      { Indicador: '% Aprobadas', Valor: this.data.practicas.porcentajes.aprobadas },

      { Indicador: 'Reprobadas', Valor: this.data.practicas.reprobadas },
      { Indicador: '% Reprobadas', Valor: this.data.practicas.porcentajes.reprobadas },

      { Indicador: 'En curso', Valor: this.data.practicas.enCurso },
      { Indicador: '% En curso', Valor: this.data.practicas.porcentajes.enCurso },

      { Indicador: '% aprobación (solo evaluadas)', Valor: this.data.practicas.porcentajeAprobacionEvaluadas },

      { Indicador: 'Encuestas Estudiantes (registradas)', Valor: this.data.encuestasEstudiantes.totalEncuestas },
      { Indicador: 'Alternativas respondidas (Estudiantes)', Valor: this.data.encuestasEstudiantes.totalAlternativasRespondidas },
      { Indicador: '% Satisfacción Estudiantes', Valor: this.data.encuestasEstudiantes.porcentajeSatisfaccion },

      { Indicador: 'Encuestas Colaboradores (registradas)', Valor: this.data.encuestasColaboradores.totalEncuestas },
      { Indicador: 'Alternativas respondidas (Colaboradores)', Valor: this.data.encuestasColaboradores.totalAlternativasRespondidas },
      { Indicador: '% Satisfacción Colaboradores', Valor: this.data.encuestasColaboradores.porcentajeSatisfaccion },
    ];

    const ws = XLSX.utils.json_to_sheet(json);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Satisfaccion');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `reporte_satisfaccion_${this.data.anio}_S${this.data.semestre}.xlsx`
    );
  }
}
