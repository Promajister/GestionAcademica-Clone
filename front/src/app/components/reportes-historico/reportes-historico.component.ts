import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';

import { BaseChartDirective } from 'ng2-charts';
import type { ChartConfiguration, ChartData } from 'chart.js';

import { ReportesService, ReportesHistoricoResponse } from '../../services/reportes.service';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

type GroupBy = 'semester' | 'year';

const TIPOS_PRACTICA = [
  { label: 'PRÁCTICA DE APOYO A LA DOCENCIA I', value: 'PRÁCTICA DE APOYO A LA DOCENCIA I' },
  { label: 'PRÁCTICA DE APOYO A LA DOCENCIA II', value: 'PRÁCTICA DE APOYO A LA DOCENCIA II' },
  { label: 'PRÁCTICA DE APOYO A LA DOCENCIA III', value: 'PRÁCTICA DE APOYO A LA DOCENCIA III' },
  { label: 'PRÁCTICA DE APOYO A LA DOCENCIA IV', value: 'PRÁCTICA DE APOYO A LA DOCENCIA IV' },
  { label: 'PRÁCTICA PROFESIONAL DOCENTE', value: 'PRÁCTICA PROFESIONAL DOCENTE' },
] as const;

type TipoPracticaValue = (typeof TIPOS_PRACTICA)[number]['value'];

@Component({
  standalone: true,
  selector: 'app-reportes-historico',
  templateUrl: './reportes-historico.component.html',
  styleUrls: ['./reportes-historico.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatDividerModule,
    BaseChartDirective,
  ],
})
export class ReportesHistoricoComponent {
  private reportes = inject(ReportesService);

  fromYear = new Date().getFullYear() - 2;
  toYear = new Date().getFullYear();
  groupBy: GroupBy = 'semester';

  loading = false;
  error: string | null = null;

  data: ReportesHistoricoResponse | null = null;
  rows: any[] = [];

  displayedColumns = ['periodo', 'totalEstudiantes', 'centrosPorTipo', 'colaboradores', 'supervisores', 'talleristas'];

  tiposPractica = TIPOS_PRACTICA;
  tipo: TipoPracticaValue | null = null;

  hasSearched = false;
  filtersDirty = false;

  onFiltersChanged() {
    this.filtersDirty = true;
    this.error = null;
  }

  get showCharts(): boolean {
    return !!this.data && !this.loading && this.data?.tipo === null && this.data?.groupBy === 'semester';
  }

  get canExport(): boolean {
    return !!this.data?.series?.length && !this.loading;
  }

  lineData: ChartData<'line'> = { labels: [], datasets: [] };
  lineOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { intersect: false },
    },
    scales: { y: { beginAtZero: true } },
  };

  stackedBarData: ChartData<'bar'> = { labels: [], datasets: [] };
  stackedBarOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: { intersect: false },
    },
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true },
    },
  };

  buscar() {
    this.filtersDirty = false;
    this.hasSearched = true;
    this.loading = true;
    this.error = null;

    if (!this.fromYear || !this.toYear || this.fromYear > this.toYear) {
      this.loading = false;
      this.error = 'Rango de años inválido.';
      this.rows = [];
      this.data = null;
      this.buildChartsFromSeries([]);
      return;
    }

    this.reportes
      .getHistorico({
        fromYear: this.fromYear,
        toYear: this.toYear,
        tipo: this.tipo,
        groupBy: this.groupBy,
      })
      .subscribe({
        next: (res) => {
          this.data = res;
          this.rows = res.series ?? [];
          this.buildChartsFromSeries(this.rows);
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.error = 'No se pudo cargar el reporte histórico.';
          this.rows = [];
          this.data = null;
          this.buildChartsFromSeries([]);
        },
      });
  }

  private buildChartsFromSeries(series: any[]) {
    if (!series?.length) {
      this.lineData = { labels: [], datasets: [] };
      this.stackedBarData = { labels: [], datasets: [] };
      return;
    }

    const labels = series.map((s) => s.periodo);

    this.lineData = {
      labels,
      datasets: [
        {
          data: series.map((s) => Number(s.totalEstudiantes ?? 0)),
          label: 'Estudiantes',
          tension: 0.3,
          pointRadius: 3,
          fill: false,
        },
      ],
    };

    const tiposSet = new Set<string>();
    for (const s of series) {
      for (const c of s.centrosPorTipo ?? []) {
        tiposSet.add(String(c.tipo ?? 'SIN_TIPO'));
      }
    }
    const tipos = Array.from(tiposSet).sort((a, b) => a.localeCompare(b));

    const datasets = tipos.map((tipoCentro) => {
      const data = series.map((s) => {
        const found = (s.centrosPorTipo ?? []).find(
          (x: any) => String(x.tipo ?? 'SIN_TIPO') === tipoCentro
        );
        return Number(found?.total ?? 0);
      });

      return { label: tipoCentro, data };
    });

    this.stackedBarData = { labels, datasets };
  }

  centrosToText(row: any): string {
    if (!row?.centrosPorTipo?.length) return '—';

    return row.centrosPorTipo
      .map((x: any) => `${this.prettyTipoCentro(x.tipo)}: ${x.total}`)
      .join(' • ');
  }

  listToText(list: string[] | undefined | null, emptyValue: string = '—'): string {
    if (!list?.length) return emptyValue;
    return list.join(', ');
  }

  private titleCase(s: string): string {
    return s
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private prettyTipoCentro(tipo: any): string {
    const t = String(tipo ?? '').trim();
    const norm = t.toUpperCase().replace(/\s+/g, ' ');

    if (!norm || norm === 'SIN_TIPO' || norm === 'SIN TIPO' || norm === 'NULL' || norm === 'UNDEFINED') {
      return 'Sin tipo';
    }

    const map: Record<string, string> = {
      PARTICULAR: 'Particular',
      PARTICULAR_SUBVENCIONADO: 'Particular Subvencionado',
      'PARTICULAR SUBVENCIONADO': 'Particular Subvencionado',
      SLEP: 'SLEP',
      NO_CONVENCIONAL: 'No convencional',
      'NO CONVENCIONAL': 'No convencional',
    };

    if (map[norm]) return map[norm];

    if (norm.includes('_')) {
      return this.titleCase(norm.replace(/_/g, ' '));
    }

    return this.titleCase(t);
  }

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

    doc.text('Gestión Académica • Reporte histórico', margin, pageHeight - 18);
    doc.text(`Página ${page} / ${totalPages}`, pageWidth - margin, pageHeight - 18, { align: 'right' as any });
  }

  private wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
    return (doc as any).splitTextToSize(text, maxWidth) as string[];
  }

  exportarPDF() {
    if (!this.data?.series?.length) return;

    const data = this.data;

    (async () => {
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
        zebra: [248, 250, 252] as [number, number, number],
        cardFill: [248, 250, 252] as [number, number, number],
      };

      const safe = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));

      const [logoUta, logoFeh] = await Promise.all([
        this.loadImageAsDataURLSafe('assets/img/uta.png'),
        this.loadImageAsDataURLSafe('assets/img/feh.png'),
      ]);

      const now = new Date();
      const generatedText = `Generado: ${now.toLocaleString('es-CL')}`;

      const groupLabel = data.groupBy === 'year' ? 'Año' : 'Periodo';
      const groupLabelPretty = data.groupBy === 'year' ? 'Por año' : 'Por semestre';

      const headerData = {
        title: 'REPORTE HISTÓRICO',
        subtitle: `Prácticas • ${groupLabelPretty}`,
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

      ensureSpace(120);

      doc.setFillColor(...colors.cardFill);
      (doc as any).roundedRect(margin, y, contentW, 90, 12, 12, 'F');

      doc.setDrawColor(...colors.border);
      doc.setLineWidth(1);
      (doc as any).roundedRect(margin, y, contentW, 90, 12, 12, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...colors.text);
      doc.text('Parámetros del reporte', margin + 14, y + 26);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...colors.muted);

      const tipoTxt = safe(data.tipo ?? 'Todas');

      doc.text(`Rango: ${safe(data.fromYear)} - ${safe(data.toYear)}`, margin + 14, y + 48);
      doc.text(`Agrupación: ${groupLabelPretty}`, margin + 250, y + 48);

      const tipoLines = this.wrapText(doc, `Tipo: ${tipoTxt}`, contentW - 28);
      doc.text(tipoLines.slice(0, 2), margin + 14, y + 70);

      y += 120;

      ensureSpace(60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...colors.text);
      doc.text('SERIES HISTÓRICAS', margin, y);

      y += 8;
      doc.setDrawColor(...colors.line);
      doc.setLineWidth(1);
      doc.line(margin, y, margin + 220, y);
      y += 14;

      const tableBody = data.series.map((r) => {
        const talleristasTxt = this.listToText(r.talleristas, '');
        return [
          safe(r.periodo),
          safe(r.totalEstudiantes),
          safe(this.centrosToText(r)),
          safe(this.listToText(r.colaboradores)),
          safe(this.listToText(r.supervisores)),
          talleristasTxt,
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [[groupLabel, 'Total estudiantes', 'Centros por tipo', 'Colaboradores', 'Supervisores', 'Talleristas']],
        body: tableBody,
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
          valign: 'top',
        },
        headStyles: {
          fillColor: colors.tableHead as any,
          textColor: colors.text as any,
          fontStyle: 'bold',
          lineColor: colors.border as any,
          lineWidth: 1,
        },
        alternateRowStyles: { fillColor: colors.zebra as any },
      });

      const totalPages = (doc as any).getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        this.drawPdfHeader(doc, headerData);
        this.drawPdfFooter(doc, i, totalPages);
      }

      doc.save(`reporte_historico_${data.fromYear}_${data.toYear}.pdf`);
    })();
  }

  exportarExcel() {
    if (!this.data?.series?.length) return;

    const json = this.data.series.map((r) => ({
      Periodo: r.periodo,
      TotalEstudiantes: r.totalEstudiantes,
      CentrosPorTipo: this.centrosToText(r),
      Colaboradores: this.listToText(r.colaboradores),
      Supervisores: this.listToText(r.supervisores),
      Talleristas: this.listToText(r.talleristas, ''),
    }));

    const ws = XLSX.utils.json_to_sheet(json);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historico');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `reporte_historico_${this.data.fromYear}_${this.data.toYear}.xlsx`
    );
  }
}
