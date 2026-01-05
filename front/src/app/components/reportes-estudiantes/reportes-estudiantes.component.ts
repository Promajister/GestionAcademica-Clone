import { Component, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';

import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';

import {
  ReportesService,
  ReporteEstudiante,
  EstudianteIndexItem,
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
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatPaginatorModule,
    MatCheckboxModule,
  ],
  templateUrl: './reportes-estudiantes.component.html',
  styleUrls: ['./reportes-estudiantes.component.scss'],
})
export class ReportesEstudianteComponent {
  private reportesService = inject(ReportesService);

  // ===== listado server-side =====
  terminoBusqueda = '';
  private search$ = new Subject<string>();

  cargandoLista = false;
  errorLista: string | null = null;

  estudiantes: EstudianteIndexItem[] = [];

  pageIndex = 0; // UI 0-based
  pageSize = 10;
  totalItems = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];

  // ===== selección (checklist) =====
  private selectedRuts = new Set<string>();
  get selectedCount(): number {
    return this.selectedRuts.size;
  }
  isSelected(rut: string): boolean {
    return this.selectedRuts.has(rut);
  }

  // ===== modal detalle =====
  estudianteSeleccionado: ReporteEstudiante | null = null;
  mostrarDetalles = false;
  loadingDetalle = false;
  errorDetalle: string | null = null;

  displayedColumns = ['tipo', 'estado', 'semestre', 'centro', 'tutores', 'inicio', 'termino'];

  // ===== export =====
  exporting = false;
  exportError: string | null = null;

  constructor() {
    this.search$
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe((term) => {
        this.pageIndex = 0;
        this.cargarListado(term);
      });

    this.cargarListado('');
  }

  // -------- listado ----------
  onFiltersChange() {
    this.search$.next(this.terminoBusqueda);
  }

  onPageChange(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.cargarListado(this.terminoBusqueda);
  }

  private cargarListado(term: string) {
    this.cargandoLista = true;
    this.errorLista = null;

    this.reportesService
      .listarEstudiantes({
        search: term?.trim() || undefined,
        page: this.pageIndex + 1, // backend 1-based
        limit: this.pageSize,
        orderBy: 'nombre',
        orderDir: 'asc',
      })
      .pipe(finalize(() => (this.cargandoLista = false)))
      .subscribe({
        next: (res) => {
          this.estudiantes = res.items ?? [];
          this.totalItems = res.total ?? 0;

          // Tip UX: si estás en una página donde ya no hay items tras filtrar, vuelve a 0
          if (this.totalItems > 0 && this.estudiantes.length === 0 && this.pageIndex > 0) {
            this.pageIndex = 0;
            this.cargarListado(term);
          }
        },
        error: () => {
          this.errorLista = 'Error al cargar estudiantes.';
        },
      });
  }

  trackByRut(_: number, e: EstudianteIndexItem) {
    return e.rut;
  }

  // -------- checklist ----------
  toggleOne(rut: string, checked: boolean) {
    if (checked) this.selectedRuts.add(rut);
    else this.selectedRuts.delete(rut);
  }

  allSelectedOnPage(): boolean {
    if (!this.estudiantes?.length) return false;
    return this.estudiantes.every(e => this.selectedRuts.has(e.rut));
  }

  someSelectedOnPage(): boolean {
    if (!this.estudiantes?.length) return false;
    const selected = this.estudiantes.filter(e => this.selectedRuts.has(e.rut)).length;
    return selected > 0 && selected < this.estudiantes.length;
  }

  toggleAllOnPage(checked: boolean) {
    for (const e of this.estudiantes) {
      if (checked) this.selectedRuts.add(e.rut);
      else this.selectedRuts.delete(e.rut);
    }
  }

  limpiarSeleccion() {
    this.selectedRuts.clear();
  }

  // -------- modal ----------
  verDetalles(rut: string) {
    this.errorDetalle = null;
    this.loadingDetalle = true;
    this.estudianteSeleccionado = null;
    this.mostrarDetalles = true;

    this.reportesService
      .getReporteEstudiante(rut)
      .pipe(finalize(() => (this.loadingDetalle = false)))
      .subscribe({
        next: (res) => {
          if (!res) {
            this.errorDetalle = 'No se encontró el estudiante.';
            this.estudianteSeleccionado = null;
          } else {
            this.estudianteSeleccionado = res;
          }
        },
        error: () => {
          this.errorDetalle = 'Error al buscar el estudiante.';
        },
      });
  }

  cerrarDetalles() {
    this.mostrarDetalles = false;
    this.estudianteSeleccionado = null;
    this.errorDetalle = null;
    this.loadingDetalle = false;
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-CL');
  }

  formatPeriodo(p: any): string {
    const s = p?.semestre ?? '—';
    const a = p?.anio ?? '';
    return `${s}° ${a}`.trim();
  }

  // -------- export helpers ----------
  private getSelectedRuts(): string[] {
    return Array.from(this.selectedRuts.values());
  }

  private fetchSelectedDetalles() {
    const ruts = this.getSelectedRuts();
    if (!ruts.length) return of<ReporteEstudiante[]>([]);

    return forkJoin(
      ruts.map((rut) =>
        this.reportesService.getReporteEstudiante(rut).pipe(
          map((x) => x ?? null),
          catchError(() => of(null))
        )
      )
    ).pipe(
      map((arr) => arr.filter((x): x is ReporteEstudiante => !!x))
    );
  }

  // -------- export PDF ----------
  exportarSeleccionPDF() {
    if (!this.selectedCount || this.exporting) return;

    this.exportError = null;
    this.exporting = true;

    this.fetchSelectedDetalles()
      .pipe(finalize(() => (this.exporting = false)))
      .subscribe({
        next: (estudiantes) => {
          if (!estudiantes.length) {
            this.exportError = 'No se pudieron obtener datos para exportar.';
            return;
          }

          const doc = new jsPDF({ unit: 'pt', format: 'a4' });
          const pageWidth = doc.internal.pageSize.getWidth();

          // Header general
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.text('Reporte de Estudiantes', 40, 48);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text(`Generado: ${new Date().toLocaleString('es-CL')}`, 40, 66);

          let y = 92;

          estudiantes.forEach((est, idx) => {
            if (idx > 0) {
              // separador + salto si queda poco espacio
              y += 18;
              if (y > 720) {
                doc.addPage();
                y = 60;
              }
            }

            // Título alumno
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text(est.nombre, 40, y);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`RUT: ${est.rut}`, 40, y + 16);
            if (est.plan) doc.text(`Plan: ${est.plan}`, 40, y + 32);

            y += est.plan ? 48 : 36;

            const rows = (est.practicas ?? []).map((p: any) => [
              p.tipo || '—',
              p.estado,
              this.formatPeriodo(p),
              p.centro || '—',
              (p.tutores?.length ? p.tutores.join(', ') : '—'),
              this.formatDate(p.fechaInicio),
              this.formatDate(p.fechaTermino),
            ]);

            autoTable(doc, {
              startY: y,
              head: [['Tipo', 'Estado', 'Periodo', 'Centro', 'Supervisores', 'Inicio', 'Término']],
              body: rows.length ? rows : [['—', '—', '—', '—', '—', '—', '—']],
              styles: { font: 'helvetica', fontSize: 9, cellPadding: 6 },
              headStyles: { fillColor: [30, 64, 175], textColor: 255 }, // azul elegante
              alternateRowStyles: { fillColor: [245, 247, 252] },
              margin: { left: 40, right: 40 },
              tableWidth: pageWidth - 80,
            });

            // @ts-ignore
            y = doc.lastAutoTable.finalY + 10;
          });

          doc.save('reporte_estudiantes.pdf');
        },
        error: () => {
          this.exportError = 'Error al exportar PDF.';
        },
      });
  }

  // -------- export Excel ----------
  exportarSeleccionExcel() {
    if (!this.selectedCount || this.exporting) return;

    this.exportError = null;
    this.exporting = true;

    this.fetchSelectedDetalles()
      .pipe(finalize(() => (this.exporting = false)))
      .subscribe({
        next: (estudiantes) => {
          if (!estudiantes.length) {
            this.exportError = 'No se pudieron obtener datos para exportar.';
            return;
          }

          const rows: any[] = [];

          for (const est of estudiantes) {
            const practicas = est.practicas ?? [];
            if (!practicas.length) {
              rows.push({
                Estudiante: est.nombre,
                RUT: est.rut,
                Plan: est.plan ?? '',
                Tipo: '',
                Estado: '',
                Periodo: '',
                Centro: '',
                Supervisores: '',
                Inicio: '',
                Termino: '',
              });
              continue;
            }

            for (const p of practicas as any[]) {
              rows.push({
                Estudiante: est.nombre,
                RUT: est.rut,
                Plan: est.plan ?? '',
                Tipo: p.tipo ?? '',
                Estado: p.estado ?? '',
                Periodo: this.formatPeriodo(p),
                Centro: p.centro ?? '',
                Supervisores: (p.tutores?.length ? p.tutores.join(', ') : ''),
                Inicio: this.formatDate(p.fechaInicio),
                Termino: this.formatDate(p.fechaTermino),
              });
            }
          }

          const worksheet = XLSX.utils.json_to_sheet(rows);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');

          const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
          saveAs(blob, 'reporte_estudiantes.xlsx');
        },
        error: () => {
          this.exportError = 'Error al exportar Excel.';
        },
      });
  }
}
