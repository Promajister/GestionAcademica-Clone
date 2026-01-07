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

  // ==========================
// PDF helpers (nuevo)
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

  // Paleta estilo "Ficha estudiante"
  const headerFill = [248, 250, 252]; // #f8fafc
  const line = [229, 231, 235];       // #e5e7eb
  const text = [17, 24, 39];          // #111827
  const muted = [100, 116, 139];      // #64748b

  // Fondo del header
  doc.setFillColor(headerFill[0], headerFill[1], headerFill[2]);
  doc.rect(0, 0, pageWidth, headerH, 'F');

  // Logos
  const drawLogo = (dataUrl: string | null | undefined, boxX: number, boxY: number, boxW: number, boxH: number) => {
    if (!dataUrl) return;
    // jsPDF no sabe el tamaño real del PNG sin decodificar; usamos box fijo y lo dibujamos “centrado” por convención
    // (si tus logos vienen bien proporcionados, se ve perfecto).
    doc.addImage(dataUrl, 'PNG', boxX, boxY, boxW, boxH);
  };

  // Tamaños similares a la ficha
  drawLogo(opts.logoLeft, margin, 18, 76, 56);                        // UTA
  drawLogo(opts.logoRight, pageWidth - margin - 76, 10, 76, 76);      // FEH

  // Títulos centrados
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(text[0], text[1], text[2]);
  doc.text(opts.title, pageWidth / 2, 36, { align: 'center' as any });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(opts.subtitle, pageWidth / 2, 56, { align: 'center' as any });

  doc.setFontSize(9);
  doc.text(opts.generatedText, pageWidth / 2, 72, { align: 'center' as any });

  // Línea inferior
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.setLineWidth(1);
  doc.line(margin, headerH, pageWidth - margin, headerH);
}

private drawPdfFooter(doc: jsPDF, page: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 52;
  const line = [229, 231, 235];  // #e5e7eb
  const muted = [100, 116, 139]; // #64748b

  const footerY = pageHeight - 34;

  doc.setDrawColor(line[0], line[1], line[2]);
  doc.setLineWidth(1);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(muted[0], muted[1], muted[2]);

  doc.text('Gestión Académica • Reporte de estudiantes', margin, pageHeight - 18);
  doc.text(`Página ${page} / ${totalPages}`, pageWidth - margin, pageHeight - 18, { align: 'right' as any });
}

// ==========================
// PDF export (nuevo)
// ==========================
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

          // Logos (mismos que la ficha)
          const [logoUta, logoFeh] = await Promise.all([
            this.loadImageAsDataURLSafe('assets/img/uta.png'),
            this.loadImageAsDataURLSafe('assets/img/feh.png'),
          ]);

          const doc = new jsPDF({ unit: 'pt', format: 'letter' });

          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();

          const margin = 52;
          const headerH = 92;
          const top = headerH + 22;
          const bottom = 54;
          const contentW = pageWidth - margin * 2;

          const colors = {
            text: [17, 24, 39] as [number, number, number],   // #111827
            muted: [100, 116, 139] as [number, number, number],// #64748b
            line: [229, 231, 235] as [number, number, number], // #e5e7eb
            border: [209, 213, 219] as [number, number, number],// #d1d5db
            tableHead: [241, 245, 249] as [number, number, number],// #f1f5f9
          };

          const now = new Date();
          const generatedText = `Generado: ${now.toLocaleString('es-CL')}`;

          const headerData = {
            title: 'REPORTE DE ESTUDIANTES',
            subtitle: 'Registro académico y prácticas',
            generatedText,
            logoLeft: logoUta,
            logoRight: logoFeh,
          };

          // Dibuja header en la 1ra página
          this.drawPdfHeader(doc, headerData);

          let y = top;

          const ensureSpace = (needed: number) => {
            if (y + needed <= pageHeight - bottom) return;
            doc.addPage();
            this.drawPdfHeader(doc, headerData);
            y = top;
          };

          const safe = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));

          const sectionTitle = (text: string) => {
            y += 16;
            ensureSpace(60);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            doc.text(text.toUpperCase(), margin, y);

            y += 8;
            doc.setDrawColor(colors.line[0], colors.line[1], colors.line[2]);
            doc.setLineWidth(1);
            doc.line(margin, y, margin + 260, y);

            y += 14;
          };

          for (let idx = 0; idx < estudiantes.length; idx++) {
            const est = estudiantes[idx];

            // Bloque estudiante (compacto, formal)
            ensureSpace(80);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            doc.text(safe(est.nombre), margin, y);

            y += 14;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
            doc.text(`RUT: ${safe(est.rut)}  •  Plan: ${safe(est.plan)}`, margin, y);

            y += 14;

            doc.setDrawColor(colors.line[0], colors.line[1], colors.line[2]);
            doc.line(margin, y, pageWidth - margin, y);

            y += 10;

            // Sección prácticas
            sectionTitle('Historial de prácticas');

            const practicas = (est as any).practicas ?? [];

            if (!practicas.length) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(10);
              doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
              doc.text('Sin prácticas registradas.', margin, y);
              y += 14;
            } else {
              const cols = [
                { label: 'N°', w: 34 },
                { label: 'Tipo', w: 170 },
                { label: 'Estado', w: 82 },
                { label: 'Periodo', w: 86 },
                { label: 'Centro', w: contentW - (34 + 170 + 82 + 86) },
              ];

              autoTable(doc, {
                startY: y,
                head: [[cols[0].label, cols[1].label, cols[2].label, cols[3].label, cols[4].label]],
                body: practicas.map((p: any, i: number) => [
                  String(i + 1),
                  safe(p.tipo),
                  safe(p.estado),
                  this.formatPeriodo(p),
                  safe(p.centro),
                ]),
                margin: { left: margin, right: margin, top, bottom },
                styles: {
                  font: 'helvetica',
                  fontSize: 9,
                  cellPadding: 6,
                  textColor: colors.text,
                  lineColor: colors.line,
                  lineWidth: 0.8,
                  overflow: 'linebreak',
                },
                headStyles: {
                  fillColor: colors.tableHead,
                  textColor: colors.text,
                  fontStyle: 'bold',
                  lineColor: colors.border,
                  lineWidth: 1,
                },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                  0: { cellWidth: cols[0].w, halign: 'center' },
                  1: { cellWidth: cols[1].w },
                  2: { cellWidth: cols[2].w },
                  3: { cellWidth: cols[3].w },
                  4: { cellWidth: cols[4].w },
                },
                tableWidth: contentW,
              });

              // @ts-ignore
              y = doc.lastAutoTable.finalY + 12;
            }

            // Separador entre estudiantes (si no es el último)
            if (idx < estudiantes.length - 1) {
              ensureSpace(30);
              doc.setDrawColor(colors.line[0], colors.line[1], colors.line[2]);
              doc.line(margin, y, pageWidth - margin, y);
              y += 12;
            }
          }

          // Footer con páginas (segunda pasada, como en tu ficha)
          const totalPages = (doc as any).getNumberOfPages();

          for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            this.drawPdfHeader(doc, headerData);
            this.drawPdfFooter(doc, i, totalPages);
          }


          doc.save('reporte_estudiantes.pdf');
        } catch {
          this.exportError = 'Error al generar PDF.';
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
        try {
          if (!estudiantes.length) {
            this.exportError = 'No se pudieron obtener datos para exportar.';
            return;
          }

          const rows: any[] = [];

          for (const est of estudiantes as any[]) {
            const practicas = est.practicas ?? [];

            // Si no tiene prácticas, igualmente agregar fila base
            if (!practicas.length) {
              rows.push({
                Estudiante: est.nombre ?? '',
                RUT: est.rut ?? '',
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

            for (const p of practicas) {
              rows.push({
                Estudiante: est.nombre ?? '',
                RUT: est.rut ?? '',
                Plan: est.plan ?? '',
                Tipo: p.tipo ?? '',
                Estado: p.estado ?? '',
                Periodo: this.formatPeriodo(p),
                Centro: p.centro ?? '',
                Supervisores: Array.isArray(p.tutores) ? p.tutores.join(', ') : (p.tutores ?? ''),
                Inicio: this.formatDate(p.fechaInicio ?? p.fecha_inicio ?? null),
                Termino: this.formatDate(p.fechaTermino ?? p.fecha_termino ?? null),
              });
            }
          }

          const worksheet = XLSX.utils.json_to_sheet(rows);

          // Ajuste simple de anchos (opcional, pero mejora)
          worksheet['!cols'] = [
            { wch: 34 }, // Estudiante
            { wch: 14 }, // RUT
            { wch: 16 }, // Plan
            { wch: 28 }, // Tipo
            { wch: 14 }, // Estado
            { wch: 12 }, // Periodo
            { wch: 28 }, // Centro
            { wch: 28 }, // Supervisores
            { wch: 12 }, // Inicio
            { wch: 12 }, // Termino
          ];

          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');

          const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
          saveAs(blob, 'reporte_estudiantes.xlsx');
        } catch {
          this.exportError = 'Error al exportar Excel.';
        }
      },
      error: () => {
        this.exportError = 'Error al exportar Excel.';
      },
    });
}





}
