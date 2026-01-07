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
import { MatDialog } from '@angular/material/dialog';
import { DetalleEstudianteDialogComponent } from './detalle-estudiante-dialog.component';


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

  private dialog = inject(MatDialog);

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

  verDetalles(rut: string) {
    const dialogRef = this.dialog.open(DetalleEstudianteDialogComponent, {
      width: '1000px',
      maxWidth: '95vw',
      autoFocus: false,
      data: {
        loading: true,
        estudiante: null,
        error: null
      }
    });

    this.reportesService.getReporteEstudiante(rut).subscribe({
      next: (res) => {
        dialogRef.componentInstance.data = {
          loading: false,
          estudiante: res,
          error: null
        };
      },
      error: () => {
        dialogRef.componentInstance.data = {
          loading: false,
          estudiante: null,
          error: 'Error al cargar el estudiante'
        };
      }
    });
  }

  cerrarDetalles() {
    this.mostrarDetalles = false;
    this.estudianteSeleccionado = null;
    this.errorDetalle = null;
    this.loadingDetalle = false;
    document.body.classList.remove('student-modal-open');
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

  private async loadImageAsDataURL(path: string): Promise<string> {
    const res = await fetch(path);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private addPdfHeaderFooter(
    doc: jsPDF,
    opts: {
      title: string;
      subtitle: string;
      generatedText: string;
      logoDataUrl?: string;
    }
  ) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Paleta (similar al logo)
    const NAVY: [number, number, number] = [10, 26, 75];   // azul marino
    const GOLD: [number, number, number] = [245, 180, 0];  // dorado

    const marginX = 48;

    // Banda superior
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageWidth, 74, 'F');

    // Línea dorada inferior (detalle)
    doc.setFillColor(...GOLD);
    doc.rect(0, 74, pageWidth, 3, 'F');

    // Título / subtítulo
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(opts.title, marginX, 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(230, 235, 255);
    doc.text(opts.subtitle, marginX, 52);

    doc.setTextColor(230, 235, 255);
    doc.setFontSize(9);
    doc.text(opts.generatedText, marginX, 66);

    // Logo arriba a la derecha (si existe)
    if (opts.logoDataUrl) {
      const logoSize = 46; // ajustable
      const x = pageWidth - marginX - logoSize;
      const y = 14;
      // PNG recomendado
      doc.addImage(opts.logoDataUrl, 'PNG', x, y, logoSize, logoSize);
    }

    // Footer (línea + paginado)
    const footerY = pageHeight - 34;
    doc.setDrawColor(210, 215, 230);
    doc.line(marginX, footerY, pageWidth - marginX, footerY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    const pageNumber = (doc as any).internal.getNumberOfPages?.() ?? 1;
    // NOTA: El número final se ajusta al final en la export (ver abajo)
    doc.text(`Página ${pageNumber}`, pageWidth - marginX, footerY + 18, { align: 'right' });
  }

  exportarSeleccionPDF() {
    if (!this.selectedCount || this.exporting) return;

    this.exportError = null;
    this.exporting = true;

    this.fetchSelectedDetalles()
      .pipe(finalize(() => (this.exporting = false)))
      .subscribe({
        next: async (estudiantes) => {
          try {
            if (!estudiantes.length) {
              this.exportError = 'No se pudieron obtener datos para exportar.';
              return;
            }

            const logoDataUrl = await this.loadImageAsDataURL('assets/img/feh.png');

            const NAVY: [number, number, number] = [10, 26, 75];
            const GOLD: [number, number, number] = [245, 180, 0];

            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const marginX = 48;

            this.addPdfHeaderFooter(doc, {
              title: 'Reporte de Estudiantes',
              subtitle: 'Sistema de Prácticas · Jefatura de Carrera',
              generatedText: `Generado: ${new Date().toLocaleString('es-CL')}`,
              logoDataUrl,
            });

            let y = 98;

            for (let idx = 0; idx < estudiantes.length; idx++) {
              const est = estudiantes[idx];

              // Salto de página si queda poco espacio
              if (y > 700) {
                doc.addPage();
                this.addPdfHeaderFooter(doc, {
                  title: 'Reporte de Estudiantes',
                  subtitle: 'Sistema de Prácticas · Jefatura de Carrera',
                  generatedText: `Generado: ${new Date().toLocaleString('es-CL')}`,
                  logoDataUrl,
                });
                y = 98;
              }

              // ===== “Card” de estudiante =====
              // Fondo suave
              doc.setFillColor(248, 250, 252);
              doc.roundedRect(marginX, y - 10, pageWidth - marginX * 2, 56, 10, 10, 'F');

              // Barra lateral dorada (detalle)
              doc.setFillColor(...GOLD);
              doc.roundedRect(marginX, y - 10, 6, 56, 6, 6, 'F');

              // Nombre
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(12.5);
              doc.setTextColor(15);
              doc.text(est.nombre, marginX + 14, y + 10);

              // RUT y Plan
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(10);
              doc.setTextColor(90);
              doc.text(`RUT: ${est.rut}`, marginX + 14, y + 28);
              doc.text(`Plan: ${est.plan ?? '—'}`, marginX + 160, y + 28);

              y += 64;

              // ===== Tabla prácticas =====
              const rows = (est.practicas ?? []).map((p: any) => [
                p.tipo || '—',
                p.estado || '—',
                this.formatPeriodo(p),
                p.centro || '—',
                (p.tutores?.length ? p.tutores.join(', ') : '—'),
                this.formatDate(p.fechaInicio),
                this.formatDate(p.fechaTermino),
              ]);

              if (rows.length) {
                autoTable(doc, {
                  startY: y,
                  head: [['Tipo', 'Estado', 'Periodo', 'Centro', 'Supervisores', 'Inicio', 'Término']],
                  body: rows,
                  styles: {
                    font: 'helvetica',
                    fontSize: 9,
                    cellPadding: 6,
                    textColor: 25,
                    lineColor: [225, 230, 242],
                    lineWidth: 0.6,
                  },
                  headStyles: {
                    fillColor: NAVY,
                    textColor: 255,
                    fontStyle: 'bold',
                  },
                  alternateRowStyles: { fillColor: [245, 247, 252] },
                  margin: { left: marginX, right: marginX },
                  tableWidth: pageWidth - marginX * 2,
                });

                // @ts-ignore
                y = doc.lastAutoTable.finalY + 18;
              } else {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(120);
                doc.text('Sin prácticas registradas.', marginX + 14, y + 10);
                y += 28;
              }

              // Separador suave entre estudiantes
              if (idx < estudiantes.length - 1) {
                doc.setDrawColor(225, 230, 242);
                doc.line(marginX, y, pageWidth - marginX, y);
                y += 18;
              }
            }

            // Guardar
            doc.save('reporte_estudiantes.pdf');
          } catch (e) {
            this.exportError = 'Error al generar PDF con logo.';
          }
        },
        error: () => {
          this.exportError = 'Error al exportar PDF.';
        },
      });
  }

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
