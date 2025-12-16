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

  // KPIs (los que ya tienes)
  reporteData = {
    totalStudents: 0,
    activeInternships: 0,
    completedInternships: 0,
    schools: 0,
    supervisors: 0,
  };

  // NUEVO: indicadores/satisfacción para mostrar después si quieres (en la vista o debug)
  indicadores: ReportesIndicadores | null = null;
  satisfaccion: ReporteSatisfaccion | null = null;

  recentActivities: { description: string; date: string }[] = [];
  deadlines: { task: string; date: string }[] = [];

  // Charts
  donutType: ChartType = 'doughnut';
  donutData: ChartData<'doughnut'> = { labels: [], datasets: [{ data: [] }] };

  lineData: ChartData<'line'> = {
    labels: [],
    datasets: [{ data: [], label: 'Prácticas' }],
  };

  lineOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false, // recomendado si le diste altura al contenedor
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  ngOnInit(): void {
    this.loading = true;
    this.error = null;

    const anio = new Date().getFullYear();

    // Cargamos todo junto: summary + indicadores + satisfacción
    forkJoin({
      summary: this.reportesService.getSummary(),
      indicadores: this.reportesService.getIndicadores().pipe(
        catchError(() => of(null)) // si no existe aún el endpoint, no revienta la vista
      ),
      satisfaccion: this.reportesService.getSatisfaccion(anio).pipe(
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

    this.recentActivities = (res.recientes || []).map(a => ({
      description: a.nombre,
      date: this.formatDate(a.fecha),
    }));

    const today = new Date();
    const LIMIT_DAYS = 7;

    this.deadlines = (res.vencimientos || [])
      .filter(v => {
        const fecha = new Date(v.fechaTermino);
        if (isNaN(fecha.getTime())) return false;

        const diffDays =
          (fecha.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

        return diffDays >= 0 && diffDays <= LIMIT_DAYS;
      })
      .map(v => ({
        task: `Práctica #${v.practicaId} — ${v.estudiante} (${v.centro})`,
        date: this.formatDate(v.fechaTermino),
      }));
  }

  private buildCharts(res: ReportesSummary): void {
    this.donutData = {
      labels: res.charts.practicasPorEstado.map(x => x.label),
      datasets: [{ data: res.charts.practicasPorEstado.map(x => x.value) }],
    };

    this.lineData = {
      labels: res.charts.practicasPorMes.map(x => x.mes),
      datasets: [{ data: res.charts.practicasPorMes.map(x => x.value), label: 'Prácticas' }],
    };
  }

  formatDate(value: string): string {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString('es-CL');
  }


}
