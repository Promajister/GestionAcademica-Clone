import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';

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
import autoTable, { type RowInput, type CellDef } from 'jspdf-autotable';
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

  terminoBusqueda = '';
  private search$ = new Subject<string>();

  // ===== Modal detalles (inline, como antes) =====
  estudianteSeleccionado: ReporteEstudiante | null = null;
  detallesLoading = false;
  detallesError: string | null = null;

  cargandoLista = false;
  errorLista: string | null = null;

  estudiantes: EstudianteIndexItem[] = [];

  pageIndex = 0;
  pageSize = 10;
  totalItems = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];

  private selectedRuts = new Set<string>();
  get selectedCount(): number {
    return this.selectedRuts.size;
  }
  isSelected(rut: string): boolean {
    return this.selectedRuts.has(rut);
  }

  displayedColumns = ['tipo', 'estado', 'semestre', 'centro', 'tutores', 'inicio', 'termino'];

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
        page: this.pageIndex + 1,
        limit: this.pageSize,
        orderBy: 'nombre',
        orderDir: 'asc',
      })
      .pipe(finalize(() => (this.cargandoLista = false)))
      .subscribe({
        next: (res) => {
          this.estudiantes = res.items ?? [];
          this.totalItems = res.total ?? 0;

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

  toggleOne(rut: string, checked: boolean) {
    if (checked) this.selectedRuts.add(rut);
    else this.selectedRuts.delete(rut);
  }

  allSelectedOnPage(): boolean {
    if (!this.estudiantes?.length) return false;
    return this.estudiantes.every((e) => this.selectedRuts.has(e.rut));
  }

  someSelectedOnPage(): boolean {
    if (!this.estudiantes?.length) return false;
    const selected = this.estudiantes.filter((e) => this.selectedRuts.has(e.rut)).length;
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

  // ===== Detalles (inline, como antes; sin MatDialog) =====
  verDetalles(rut: string) {
  this.detallesError = null;
  this.detallesLoading = true;

  // abre el modal altiro (como antes)
  this.estudianteSeleccionado = { rut } as any;

  this.reportesService
    .getReporteEstudiante(rut)
    .pipe(finalize(() => (this.detallesLoading = false)))
    .subscribe({
      next: (res) => {
        this.estudianteSeleccionado = res ?? null;
        if (!this.estudianteSeleccionado) {
          this.detallesError = 'No se encontró información del estudiante.';
        }
      },
      error: () => {
        this.detallesError = 'Error al cargar el estudiante';
        // Mantén el modal abierto para mostrar el error:
        // this.estudianteSeleccionado sigue siendo truthy si quieres ver el mensaje.
        // Si lo pones null, se cierra y "no se ve nada".
        this.estudianteSeleccionado = { rut } as any;
      },
    });
}


  cerrarDetalles() {
    this.estudianteSeleccionado = null;
    this.detallesLoading = false;
    this.detallesError = null;
  }

  practicasCount(): number {
    return (this.estudianteSeleccionado as any)?.practicas?.length ?? 0;
  }

  // ===== Helpers =====
  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-CL');
  }

  formatPeriodo(p: any): string {
    const s = p?.semestre ?? null;
    const a = p?.anio ?? null;

    if (!s && !a) return '—';

    const semestreTxt = s ? `${s}° semestre` : '—';
    const anioTxt = a ? String(a) : '';

    return anioTxt ? `${semestreTxt} ${anioTxt}` : semestreTxt;
  }

  private formatPeriodoLinea(p: any): string {
    const periodo = this.formatPeriodo(p);
    const ini = this.formatDate(p?.fechaInicio ?? p?.fecha_inicio ?? null);
    const fin = this.formatDate(p?.fechaTermino ?? p?.fecha_termino ?? null);

    const hasIni = ini && ini !== '—';
    const hasFin = fin && fin !== '—';

    if (!hasIni && !hasFin) return `Periodo: ${periodo}`;
    if (hasIni && !hasFin) return `Periodo: ${periodo}, desde ${ini}`;
    if (!hasIni && hasFin) return `Periodo: ${periodo}, hasta ${fin}`;
    return `Periodo: ${periodo}, desde ${ini} hasta ${fin}`;
  }

  formatSupervisor(p: any): string {
    const t = p?.tutores ?? p?.supervisores ?? p?.supervisor ?? null;
    if (Array.isArray(t)) return t.length ? String(t[0]) : '—';
    return t ? String(t) : '—';
  }

  private formatTipo(value: any): string {
    const s = value ? String(value) : '-';
    return s.replace(/\s+/g, ' ').trim();
  }

  private formatNotaFinal(value: any): string {
    return value === null || value === undefined || value === '' ? '-' : String(value);
  }

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
    ).pipe(map((arr) => arr.filter((x): x is ReporteEstudiante => !!x)));
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

    const headerFill = [248, 250, 252];
    const line = [229, 231, 235];
    const text = [17, 24, 39];
    const muted = [100, 116, 139];

    doc.setFillColor(headerFill[0], headerFill[1], headerFill[2]);
    doc.rect(0, 0, pageWidth, headerH, 'F');

    const drawLogo = (dataUrl: string | null | undefined, x: number, y: number, w: number, h: number) => {
      if (!dataUrl) return;
      doc.addImage(dataUrl, 'PNG', x, y, w, h);
    };

    drawLogo(opts.logoLeft, margin, 18, 76, 56);
    drawLogo(opts.logoRight, pageWidth - margin - 76, 10, 76, 76);

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

    doc.setDrawColor(line[0], line[1], line[2]);
    doc.setLineWidth(1);
    doc.line(margin, headerH, pageWidth - margin, headerH);
  }

  private drawPdfFooter(doc: jsPDF, page: number, totalPages: number) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 52;
    const line = [229, 231, 235];
    const muted = [100, 116, 139];

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

  private buildStudentHead(est: any): RowInput[] {
    const safe = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));

    const title = safe(est?.nombre);
    const sub = `RUT: ${safe(est?.rut)}  •  Plan: ${safe(est?.plan)}`;

    const rowTitle: RowInput = [
      { content: title, colSpan: 6, styles: { fontStyle: 'bold' as any } } as CellDef,
    ];

    const rowSub: RowInput = [
      { content: sub, colSpan: 6, styles: { fontStyle: 'normal' as any } } as CellDef,
    ];

    const rowCols: RowInput = ['N°', 'Tipo', 'Estado', 'Nota final', 'Supervisor', 'Centro Educativo'];

    return [rowTitle, rowSub, rowCols];
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
              text: [0, 0, 0] as [number, number, number],
              line: [229, 231, 235] as [number, number, number],
              border: [209, 213, 219] as [number, number, number],
              tableHead: [241, 245, 249] as [number, number, number],
              zebra: [248, 250, 252] as [number, number, number],
              studentBar: [248, 250, 252] as [number, number, number],
            };

            const safe = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));
            const generatedText = `Generado: ${new Date().toLocaleString('es-CL')}`;

            const headerData = {
              title: 'REPORTE DE ESTUDIANTES',
              subtitle: 'Registro académico y prácticas',
              generatedText,
              logoLeft: logoUta,
              logoRight: logoFeh,
            };

            this.drawPdfHeader(doc, headerData);

            let y = top;

            const newPageIfLow = (minRemaining: number) => {
              if (y <= pageHeight - bottom - minRemaining) return;
              doc.addPage();
              this.drawPdfHeader(doc, headerData);
              y = top;
            };

            const wN = 30;
            const wTipo = 150;
            const wEstado = 80;
            const wNota = 45;
            const wSupervisor = 110;
            const wCentro = contentW - (wN + wTipo + wEstado + wNota + wSupervisor);

            for (let idx = 0; idx < estudiantes.length; idx++) {
              const est: any = estudiantes[idx];
              const practicas = est?.practicas ?? [];

              newPageIfLow(160);

              const head = this.buildStudentHead(est);

              const body: RowInput[] =
                practicas.length === 0
                  ? [[{ content: 'Sin prácticas registradas.', colSpan: 6 } as CellDef]]
                  : practicas.flatMap((p: any, i: number) => {
                      const filaPrincipal: RowInput = [
                        String(i + 1),
                        this.formatTipo(p?.tipo),
                        safe(p?.estado),
                        this.formatNotaFinal(p?.notaFinal ?? p?.nota_final),
                        this.formatSupervisor(p),
                        safe(p?.centro),
                      ];

                      const filaPeriodo: RowInput = [
                        '',
                        {
                          content: this.formatPeriodoLinea(p),
                          colSpan: 5,
                          styles: { fontStyle: 'normal' as any, textColor: colors.text as any } as any,
                        } as CellDef,
                      ];

                      return [filaPrincipal, filaPeriodo];
                    });

              autoTable(doc, {
                startY: y,
                head,
                body,
                showHead: 'everyPage',
                margin: { left: margin, right: margin, top, bottom },
                tableWidth: contentW,
                styles: {
                  font: 'helvetica',
                  fontSize: 9,
                  cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
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
                columnStyles: {
                  0: { cellWidth: wN, halign: 'center' },
                  1: { cellWidth: wTipo },
                  2: { cellWidth: wEstado },
                  3: { cellWidth: wNota, halign: 'center' },
                  4: { cellWidth: wSupervisor },
                  5: { cellWidth: wCentro },
                },
                didParseCell: (data) => {
                  if (data.section === 'head') {
                    if (data.row.index === 0) {
                      data.cell.styles.fillColor = colors.studentBar as any;
                      data.cell.styles.textColor = colors.text as any;
                      data.cell.styles.fontSize = 11 as any;
                      data.cell.styles.fontStyle = 'bold' as any;
                      data.cell.styles.lineColor = colors.border as any;
                      data.cell.styles.lineWidth = 1 as any;
                    }
                    if (data.row.index === 1) {
                      data.cell.styles.fillColor = colors.studentBar as any;
                      data.cell.styles.textColor = colors.text as any;
                      data.cell.styles.fontSize = 9 as any;
                      data.cell.styles.fontStyle = 'normal' as any;
                      data.cell.styles.lineColor = colors.border as any;
                      data.cell.styles.lineWidth = 1 as any;
                    }
                    if (data.row.index === 2) {
                      data.cell.styles.fillColor = colors.tableHead as any;
                      data.cell.styles.textColor = colors.text as any;
                      data.cell.styles.fontSize = 9 as any;
                      data.cell.styles.fontStyle = 'bold' as any;
                      data.cell.styles.lineColor = colors.border as any;
                      data.cell.styles.lineWidth = 1 as any;
                    }
                  }

                  if (data.section === 'body') {
                    if (practicas.length > 0 && data.row.index % 2 === 1) {
                      data.cell.styles.fillColor = colors.zebra as any;
                      data.cell.styles.fontSize = 9 as any;
                      data.cell.styles.textColor = colors.text as any;
                      data.cell.styles.lineWidth = 0.5 as any;
                    }

                    if (practicas.length > 0 && data.row.index % 2 === 1 && data.column.index === 0) {
                      data.cell.text = [''];
                    }
                  }

                  if (data.section === 'body' && practicas.length === 0) {
                    data.cell.styles.textColor = colors.text as any;
                    data.cell.styles.halign = 'left' as any;
                  }
                },
              });

              y = ((doc as any).lastAutoTable?.finalY ?? y) + 18;
            }

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

              if (!practicas.length) {
                rows.push({
                  Estudiante: est.nombre ?? '',
                  RUT: est.rut ?? '',
                  Plan: est.plan ?? '',
                  Tipo: '',
                  Estado: '',
                  'Nota final': '-',
                  Periodo: '',
                  Centro: '',
                  Supervisor: '',
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
                  'Nota final': this.formatNotaFinal(p.notaFinal ?? p.nota_final),
                  Periodo: this.formatPeriodo(p),
                  Centro: p.centro ?? '',
                  Supervisor: this.formatSupervisor(p),
                  Inicio: this.formatDate(p.fechaInicio ?? p.fecha_inicio ?? null),
                  Termino: this.formatDate(p.fechaTermino ?? p.fecha_termino ?? null),
                });
              }
            }

            const worksheet = XLSX.utils.json_to_sheet(rows);

            worksheet['!cols'] = [
              { wch: 34 },
              { wch: 14 },
              { wch: 16 },
              { wch: 28 },
              { wch: 14 },
              { wch: 12 },
              { wch: 22 },
              { wch: 28 },
              { wch: 22 },
              { wch: 12 },
              { wch: 12 },
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
