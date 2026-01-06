import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';

// Charts
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import 'chart.js/auto';

import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  ReportesService,
  ReportesSummary,
  ReportesIndicadores,
  ReporteSatisfaccion,
} from '../../services/reportes.service';

@Component({
  standalone: true,
  selector: 'app-reportes',
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    BaseChartDirective,

  ],
})
export class ReportesComponent implements OnInit {
  private reportesService = inject(ReportesService);

  loading = true;
  error: string | null = null;

  reporteData = {
    totalStudents: 0,
    activeInternships: 0,
    completedInternships: 0,
    schools: 0,
    supervisors: 0,
  };

  indicadores: ReportesIndicadores | null = null;
  satisfaccion: ReporteSatisfaccion | null = null;

  recentActivities: { description: string; date: string }[] = [];
  deadlines: { task: string; date: string }[] = [];

  // Charts
  donutType: ChartType = 'doughnut';
  donutData: ChartData<'doughnut'> = { labels: [], datasets: [{ data: [] }] };

  //relleno (sin agujero) + mejoras visuales
  donutOptions: ChartConfiguration<'doughnut'>['options'] = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right', 
      align: 'start', 
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        padding: 12,
        usePointStyle: true, // se ve más fino
        pointStyle: 'rectRounded',
      },
    },
    tooltip: {
      enabled: true,
    },
  },
};

  lineData: ChartData<'line'> = {
    labels: [],
    datasets: [{ data: [], label: 'Prácticas', tension: 0.35, pointRadius: 3 }],
  };

  lineOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
      x: { ticks: { maxRotation: 0 } },
    },
  };

  ngOnInit(): void {
    this.loading = true;
    this.error = null;

    const anio = new Date().getFullYear();

    forkJoin({
      summary: this.reportesService.getSummary(),
      indicadores: this.reportesService.getIndicadores().pipe(
        catchError(() => of(null))
      ),
      satisfaccion: this.reportesService.getSatisfaccion({
        anio,
        semestre: 1,
        tipo: null,
      }).pipe(
        catchError(() => of(null))
      ),
    }).subscribe({
      next: ({ summary, indicadores, satisfaccion }) => {
        this.applySummary(summary);
        this.buildCharts(summary);

        this.indicadores = indicadores;
        this.satisfaccion = satisfaccion;

        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudo cargar el reporte.';
      },
    });
  }

  private applySummary(res: ReportesSummary): void {
    this.reporteData = {
      totalStudents: res.totals.estudiantes,
      activeInternships: res.totals.practicas.enCurso,
      completedInternships:
        res.totals.practicas.aprobadas + res.totals.practicas.reprobadas,
      schools: res.totals.centros,
      supervisors: res.totals.tutores,
    };
  }

  private buildCharts(res: ReportesSummary): void {
    this.donutData = {
      labels: res.charts.practicasPorEstado.map(x => x.label),
      datasets: [{ data: res.charts.practicasPorEstado.map(x => x.value) }],
    };

    this.lineData = {
      labels: res.charts.practicasPorMes.map(x => x.mes),
      datasets: [
        {
          data: res.charts.practicasPorMes.map(x => x.value),
          label: 'Prácticas',
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    };
  }

  formatDate(value: string): string {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString('es-CL');
  }
}
