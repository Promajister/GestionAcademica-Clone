import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ReportesService, ReporteSatisfaccion } from '../../services/reportes.service';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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
  ],
  templateUrl: './reportes-satisfaccion.component.html',
})
export class ReportesSatisfaccionComponent {
  private reportesService = inject(ReportesService);

  anio = new Date().getFullYear();
  semestre: 1 | 2 = 1;
  tipo: string | null = null; // null = Todo

  loading = false;
  error: string | null = null;

  data: ReporteSatisfaccion | null = null;

  buscar() {
    this.loading = true;
    this.error = null;
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
      ['Total estudiantes', String(this.data.totalEstudiantes)],
      ['% aprobación', `${this.data.porcentajeAprobacion}%`],
      ['Encuestas respondidas', String(this.data.encuestas.totalRespuestas)],
      ['Promedio puntaje encuestas', String(this.data.encuestas.promedioPuntaje)],
      ['% satisfacción', `${this.data.encuestas.porcentajeSatisfaccion}%`],
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
      { Indicador: 'Total estudiantes', Valor: this.data.totalEstudiantes },
      { Indicador: '% aprobación', Valor: this.data.porcentajeAprobacion },
      { Indicador: 'Encuestas respondidas', Valor: this.data.encuestas.totalRespuestas },
      { Indicador: 'Promedio puntaje encuestas', Valor: this.data.encuestas.promedioPuntaje },
      { Indicador: '% satisfacción', Valor: this.data.encuestas.porcentajeSatisfaccion },
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
