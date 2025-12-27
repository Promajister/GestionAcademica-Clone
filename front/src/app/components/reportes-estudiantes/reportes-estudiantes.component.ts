import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { MatListModule } from '@angular/material/list';

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  ReportesService,
  ReporteEstudiante,
} from '../../services/reportes.service';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';


@Component({
  standalone: true,
  selector: 'app-reportes-estudiante',
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatListModule,
  ],
  templateUrl: './reportes-estudiantes.component.html',
  styleUrls: ['./reportes-estudiantes.component.scss'],
  
})
export class ReportesEstudianteComponent {
  private reportesService = inject(ReportesService);

  rut = '';
  loading = false;
  error: string | null = null;

  estudiante: ReporteEstudiante | null = null;

  displayedColumns = [
    'tipo',
    'estado',
    'semestre',
    'centro',
    'tutores',
    'inicio',
    'termino',
  ];

  nombreQuery = '';
  resultados: { rut: string; nombre: string; plan?: string | null }[] = [];

  private search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((q) => (q.trim() ? this.reportesService.buscarEstudiantes(q) : of([])))
      )
      .subscribe((rows) => {
        this.resultados = rows;
      });
  }

  onNombreInput(value: string) {
    this.nombreQuery = value;
    this.search$.next(value);
  }

  seleccionar(rut: string) {
    this.rut = rut;
    this.resultados = [];
    this.buscar(); 
  }


  buscar() {
    this.error = null;
    this.estudiante = null;

    if (this.rut?.trim()) {
      this.loading = true;

      this.reportesService.getReporteEstudiante(this.rut).subscribe({
        next: (res) => {
          if (!res) {
            this.error = 'No se encontró el estudiante.';
          } else {
            this.estudiante = res;
          }
          this.loading = false;
        },
        error: () => {
          this.error = 'Error al buscar el estudiante.';
          this.loading = false;
        },
      });

      return;
    }

    if (this.nombreQuery?.trim()) {
      this.onNombreInput(this.nombreQuery);
      return;
    }

    this.error = 'Ingrese un RUT o un nombre.';
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString('es-CL');
  }

  exportarPDF() {
    if (!this.estudiante) return;

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('Reporte del Estudiante', 14, 15);

    doc.setFontSize(11);
    doc.text(`Nombre: ${this.estudiante.nombre}`, 14, 25);
    doc.text(`RUT: ${this.estudiante.rut}`, 14, 32);
    if (this.estudiante.plan) {
      doc.text(`Plan: ${this.estudiante.plan}`, 14, 39);
    }

    const rows = this.estudiante.practicas.map((p: any) => [
      p.tipo || '—',
      p.estado || '—',
      `${p.semestre ?? '—'}° ${p.anio ?? ''}`.trim(),
      p.centro || '—',
      p.tutores?.join(', ') || '—',
      this.formatDate(p.fechaInicio),
      this.formatDate(p.fechaTermino),
    ]);

    autoTable(doc, {
      startY: 48,
      head: [[
        'Tipo',
        'Estado',
        'Semestre',
        'Centro',
        'Supervisores',
        'Inicio',
        'Término',
      ]],
      body: rows,
    });

    doc.save(`reporte_estudiante_${this.estudiante.rut}.pdf`);
  }

  exportarExcel() {
    if (!this.estudiante) return;

    const data = this.estudiante.practicas.map((p: any) => ({
      Tipo: p.tipo || '—',
      Estado: p.estado || '—',
      Semestre: `${p.semestre ?? '—'}° ${p.anio ?? ''}`.trim(),
      Centro: p.centro || '—',
      Supervisores: p.tutores?.join(', ') || '—',
      Inicio: this.formatDate(p.fechaInicio),
      Término: this.formatDate(p.fechaTermino),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prácticas');

    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const blob = new Blob([excelBuffer], {
      type: 'application/octet-stream',
    });

    saveAs(blob, `reporte_estudiante_${this.estudiante.rut}.xlsx`);
  }
}
