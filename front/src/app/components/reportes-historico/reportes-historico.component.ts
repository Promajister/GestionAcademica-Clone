import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';

// Charts
import { BaseChartDirective } from 'ng2-charts';
import type { ChartConfiguration, ChartData } from 'chart.js';

import { ReportesService, ReportesHistoricoResponse } from '../../services/reportes.service';

// Export
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

type TipoPracticaValue = typeof TIPOS_PRACTICA[number]['value'];

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
    return !!this.data
      && !this.loading
      && (this.data?.tipo === null)           // usa el "último estado aplicado"
      && (this.data?.groupBy === 'semester'); // usa el "último estado aplicado"
  }

  get canExport(): boolean {
    return !!this.data?.series?.length && !this.loading;
  }

  // 1) Línea: estudiantes por periodo
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

  // 2) Barras apiladas: centros por tipo por periodo
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

    this.reportes.getHistorico({
      fromYear: this.fromYear,
      toYear: this.toYear,
      tipo: this.tipo,
      groupBy: this.groupBy,
    }).subscribe({
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

    const labels = series.map(s => s.periodo);

    this.lineData = {
      labels,
      datasets: [
        {
          data: series.map(s => Number(s.totalEstudiantes ?? 0)),
          label: 'Estudiantes',
          tension: 0.3,
          pointRadius: 3,
          fill: false,
        },
      ],
    };

    const tiposSet = new Set<string>();
    for (const s of series) {
      for (const c of (s.centrosPorTipo ?? [])) {
        tiposSet.add(String(c.tipo ?? 'SIN_TIPO'));
      }
    }
    const tipos = Array.from(tiposSet).sort((a, b) => a.localeCompare(b));

    const datasets = tipos.map((tipoCentro) => {
      const data = series.map((s) => {
        const found = (s.centrosPorTipo ?? []).find((x: any) => String(x.tipo ?? 'SIN_TIPO') === tipoCentro);
        return Number(found?.total ?? 0);
      });

      return { label: tipoCentro, data };
    });

    this.stackedBarData = { labels, datasets };
  }

  centrosToText(row: any): string {
    if (!row?.centrosPorTipo?.length) return '—';
    return row.centrosPorTipo.map((x: any) => `${x.tipo}: ${x.total}`).join(' • ');
  }

  listToText(list: string[]): string {
    if (!list?.length) return '—';
    return list.join(', ');
  }

  // EXPORT PDF (funcional, luego lo mejoramos visualmente como el de Estudiantes)
  exportarPDF() {
    if (!this.data?.series?.length) return;

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Reporte histórico de prácticas', 14, 15);

    doc.setFontSize(10);
    doc.text(
      `Años: ${this.data.fromYear} - ${this.data.toYear} | Agrupar: ${this.data.groupBy} | Tipo: ${this.data.tipo ?? 'Todas'}`,
      14,
      22
    );

    const rows = this.data.series.map((r) => [
      r.periodo,
      String(r.totalEstudiantes),
      this.centrosToText(r),
      this.listToText(r.colaboradores),
      this.listToText(r.supervisores),
      this.listToText(r.talleristas),
    ]);

    autoTable(doc, {
      startY: 28,
      head: [[
        this.data.groupBy === 'year' ? 'Año' : 'Periodo',
        'Total estudiantes',
        'Centros por tipo',
        'Colaboradores',
        'Supervisores',
        'Talleristas',
      ]],
      body: rows,
    });

    doc.save(`reporte_historico_${this.data.fromYear}_${this.data.toYear}.pdf`);
  }

  exportarExcel() {
    if (!this.data?.series?.length) return;

    const json = this.data.series.map((r) => ({
      Periodo: r.periodo,
      TotalEstudiantes: r.totalEstudiantes,
      CentrosPorTipo: this.centrosToText(r),
      Colaboradores: this.listToText(r.colaboradores),
      Supervisores: this.listToText(r.supervisores),
      Talleristas: this.listToText(r.talleristas),
    }));

    const ws = XLSX.utils.json_to_sheet(json);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historico');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }),
      `reporte_historico_${this.data.fromYear}_${this.data.toYear}.xlsx`
    );
  }
}
