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
  { label: 'PRÁCTICA DE APOYO A LA DOCENCIA I',   value: 'Apoyo a la Docencia I' },
  { label: 'PRÁCTICA DE APOYO A LA DOCENCIA II',  value: 'Apoyo a la Docencia II' },
  { label: 'PRÁCTICA DE APOYO A LA DOCENCIA III', value: 'Apoyo a la Docencia III' },
  { label: 'PRÁCTICA DE APOYO A LA DOCENCIA IV',  value: 'Apoyo a la Docencia IV' },
  { label: 'PRÁCTICA PROFESIONAL DOCENTE',        value: 'Práctica Profesional Docente' },
] as const;

type TipoPracticaValue = typeof TIPOS_PRACTICA[number]['value'];

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

    // si quieres limpiar al buscar para evitar “flash” de info vieja:
    this.data = null;

    this.reportesService.getSatisfaccion({
      anio: this.anio,
      semestre: this.semestre,
      tipo: this.tipo,
    }).subscribe({
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

  exportarPDF() {
    if (!this.data) return;

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Reporte de satisfacción en prácticas', 14, 15);

    doc.setFontSize(10);
    doc.text(
      `Año: ${this.data.anio} | Semestre: ${this.data.semestre} | Tipo: ${this.data.tipo ?? 'Todo'}`,
      14,
      22
    );

    const rows = [
      ['Año', String(this.data.anio)],
      ['Semestre', String(this.data.semestre)],
      ['Tipo', String(this.data.tipo ?? 'Todo')],

      ['Prácticas (total)', String(this.data.practicas.totalPracticas)],
      ['Estudiantes', String(this.data.practicas.estudiantesUnicos)],

      ['Aprobadas', `${this.data.practicas.aprobadas} (${this.data.practicas.porcentajes.aprobadas}%)`],
      ['Reprobadas', `${this.data.practicas.reprobadas} (${this.data.practicas.porcentajes.reprobadas}%)`],
      ['En curso', `${this.data.practicas.enCurso} (${this.data.practicas.porcentajes.enCurso}%)`],

      ['% aprobación (solo evaluadas)', `${this.data.practicas.porcentajeAprobacionEvaluadas}%`],

      ['Encuestas Estudiantes (registradas)', String(this.data.encuestasEstudiantes.totalEncuestas)],
      ['Alternativas respondidas (Estudiantes)', String(this.data.encuestasEstudiantes.totalAlternativasRespondidas)],
      ['% Satisfacción Estudiantes', `${this.data.encuestasEstudiantes.porcentajeSatisfaccion}%`],

      ['Encuestas Colaboradores (registradas)', String(this.data.encuestasColaboradores.totalEncuestas)],
      ['Alternativas respondidas (Colaboradores)', String(this.data.encuestasColaboradores.totalAlternativasRespondidas)],
      ['% Satisfacción Colaboradores', `${this.data.encuestasColaboradores.porcentajeSatisfaccion}%`],

    ];

    autoTable(doc, {
      startY: 28,
      head: [['Indicador', 'Valor']],
      body: rows,
    });

    doc.save(`reporte_satisfaccion_${this.data.anio}_S${this.data.semestre}.pdf`);
  }

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