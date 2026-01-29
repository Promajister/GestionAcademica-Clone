import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { ActividadesPmService } from '../../services/actividades-pm.service';
import { ActividadPmDialogComponent } from './actividad-pm-dialog.component';
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { catchError, debounceTime, distinctUntilChanged, finalize, map } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { environment } from '../../../environments/environment';
import { formatDateEs, parseDateFlexible } from '../../utils/date-utils';


@Component({
  selector: 'app-actividades-pm-gestion',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatPaginatorModule
],
  templateUrl: './actividades-pm-gestion.component.html',
  styleUrls: ['./actividades-pm-gestion.component.scss'],
})
export class ActividadesPmGestionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ActividadesPmService);
  private dialog = inject(MatDialog);
  private readonly apiBaseUrl = environment.apiUrl.replace(/\/api$/, '');

  loading = false;
  errorMsg = '';

  cols = ['nombre', 'tipoActividad', 'fecha', 'sede', 'areaImpacto', 'acciones'];
  rows: any[] = [];
  selectedIds = new Set<number>();
  exporting = false;
  exportError: string | null = null;
  pageIndex = 0;
  pageSize = 10;
  totalItems = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];

  filtroForm = this.fb.group({
    tipo: [''],
    q: [''],
    fechaInicio: [''],
    fechaTermino: [''],
  });

  tipos: { value: string; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'FERIA_VOCACIONAL', label: 'Feria Vocacional' },
    { value: 'JORNADA_PEDAGOGICA', label: 'Jornada Pedagógica' },
    { value: 'TALLER_REMEDIAL', label: 'Taller Remedial' },
    { value: 'CONGRESO_ACADEMICO', label: 'Congreso Académico' },
    { value: 'ALTERNANCIA_PEDAGOGICA', label: 'Alternancia Pedagógica' },
    { value: 'SALIDA_A_TERRENO', label: 'Salida a Terreno' },
    { value: 'OTRO', label: 'Otros' },
  ];

  private tipoActividadLabelMap: Record<string, string> = {};

  ngOnInit(): void {
    this.tipoActividadLabelMap = Object.fromEntries(
        this.tipos
        .filter(x => x.value) 
        .map(x => [x.value, x.label])
    );
    this.cargar();

    this.filtroForm.valueChanges
        .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        )
        .subscribe(() => this.cargar());
    }

  getTipoActividadLabel(value?: string): string {
    if (!value) return '-';
    return this.tipoActividadLabelMap[value] ?? value.replaceAll('_', ' ');
  }

  cargar(): void {
    this.loading = true;
    this.errorMsg = '';

    const { tipo, q } = this.filtroForm.value;

    this.api
      .listar({
        tipo: tipo || undefined,
        q: q || undefined,
        fechaInicio: this.safeDateParam(this.filtroForm.value.fechaInicio),
        fechaTermino: this.safeDateParam(this.filtroForm.value.fechaTermino),
      })
      .subscribe({
        next: (data) => {
          this.rows = data ?? [];
          this.actualizarPaginacion();
          const ids = new Set((this.rows ?? []).map((r) => Number(r?.id)).filter((id) => !Number.isNaN(id)));
          for (const id of Array.from(this.selectedIds)) {
            if (!ids.has(id)) this.selectedIds.delete(id);
          }
          this.loading = false;
        },
        error: (err) => {
          console.error(err);
          this.errorMsg = 'No se pudo cargar el listado.';
          this.totalItems = 0;
          this.loading = false;
        },
      });
  }

  abrirVer(row: any): void {
    this.dialog
        .open(ActividadPmDialogComponent, {
        width: '900px',
        maxWidth: '92vw',
        data: { id: row.id, mode: 'view' },
        disableClose: true,
        panelClass: 'ga-dialog',
        backdropClass: 'ga-dialog-backdrop',
        autoFocus: false,
        })
        .afterClosed()
        .subscribe((result) => {
        if (result?.refresh) this.cargar();
        });
  }

  abrirEditar(row: any): void {
    this.dialog.open(ActividadPmDialogComponent, {
        width: '980px',
        maxWidth: '96vw',
        maxHeight: '90vh',
        height: '90vh',      
        data: { id: row.id, mode: 'edit' },
        disableClose: true,
        panelClass: 'ga-dialog',
        backdropClass: 'ga-dialog-backdrop',
        autoFocus: false,
    })
    .afterClosed()
    .subscribe((result) => {
    if (result?.refresh) this.cargar();
    });
  }

  limpiarFiltros(): void {
    this.filtroForm.patchValue({
        tipo: '',
        q: '',
        fechaInicio: '',
        fechaTermino: '',
    });
  }

  trackById = (_: number, row: any) => row?.id;

  toggleRowSelection(row: any, checked: boolean): void {
    const id = Number(row?.id);
    if (Number.isNaN(id)) return;
    if (checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
  }

  toggleAllSelection(checked: boolean): void {
    if (!checked) {
      this.selectedIds.clear();
      return;
    }

    for (const row of this.rows ?? []) {
      const id = Number(row?.id);
      if (!Number.isNaN(id)) this.selectedIds.add(id);
    }
  }

  isRowSelected(row: any): boolean {
    const id = Number(row?.id);
    if (Number.isNaN(id)) return false;
    return this.selectedIds.has(id);
  }

  isAllSelected(): boolean {
    if (!this.rows?.length) return false;
    return this.rows.every((row) => {
      const id = Number(row?.id);
      return !Number.isNaN(id) && this.selectedIds.has(id);
    });
  }

  formatearRangoFechas(inicio?: string, termino?: string): string {
    const f = (v?: string) => {
      const raw = String(v ?? '').trim();
      if (!raw) return '-';

      const datePart = raw.includes('T') ? raw.split('T')[0] : raw;

      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
      if (!m) return raw;

      const [, yyyy, mm, dd] = m;
      return `${dd}/${mm}/${yyyy}`; 
    };

    if (!inicio && !termino) return '-';
    return `${f(inicio)} - ${f(termino)}`;
  }

  get rowsPaginadas(): any[] {
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return (this.rows ?? []).slice(startIndex, endIndex);
  }

  actualizarPaginacion(): void {
    this.totalItems = this.rows?.length ?? 0;
    const maxPage = Math.max(0, Math.ceil(this.totalItems / this.pageSize) - 1);
    if (this.pageIndex > maxPage) {
      this.pageIndex = maxPage;
    }
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  eliminar(row: any): void {
    this.dialog.open(ConfirmDialogComponent, {
        width: '520px',
        maxWidth: '92vw',
        disableClose: true,
        autoFocus: false,
        data: {
        title: 'Eliminar actividad',
        message: 'Se eliminará de forma permanente la siguiente actividad:',
        detail: row.nombre,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        tone: 'danger',
        },
    })
    .afterClosed()
    .subscribe((ok: boolean) => {
        if (!ok) return;

        this.api.eliminar(row.id).subscribe({
        next: () => this.cargar(),
        error: (err) => {
            console.error(err);
            alert('No se pudo eliminar. Puede que la actividad ya no exista.');
        },
        });
    });
  }

  exportarPdf(): void {
    if (this.exporting || !this.rows?.length) return;

    this.exportError = null;
    this.exporting = true;

    this.fetchDetalles(this.getSelectedIdsOrAll())
      .pipe(finalize(() => (this.exporting = false)))
      .subscribe({
        next: async (items) => {
          try {
            if (!items.length) {
              this.exportError = 'No se encontraron actividades para exportar.';
              return;
            }

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
              section: [248, 250, 252] as [number, number, number],
            };

            const generatedText = this.buildGeneratedText();
            const headerData = {
              title: 'REPORTE DE ACREDITACIÓN',
              subtitle: this.getFiltroYear(items),
              generatedText,
            };

            const [logoUta, logoFeh] = await Promise.all([
              this.loadLogoAsDataURLSafe('assets/img/uta.png'),
              this.loadLogoAsDataURLSafe('assets/img/feh.png'),
            ]);

            this.drawPdfHeader(doc, { ...headerData, logoLeft: logoUta, logoRight: logoFeh });

            let y = top;

            const ensureSpace = (minRemaining: number) => {
              if (y <= pageHeight - bottom - minRemaining) return;
              doc.addPage();
              y = top;
            };

            items.forEach((raw, index) => {
              const data = this.normalizeActividad(raw);
              const tipoLabel = this.getTipoActividadLabel(data.proyecto?.tipoActividad ?? data.base?.tipoActividad);

              if (index > 0) {
                doc.addPage();
                y = top;
              }

              ensureSpace(40);

              y -= 2;

              const generalRows = this.buildGeneralRows(data);
              y += 8;
              const generalRowsNormalized = generalRows.map((row) => this.normalizeTableRow(row));

              autoTable(doc, {
                startY: y,
                body: generalRowsNormalized,
                margin: { left: margin, right: margin, top, bottom },
                tableWidth: contentW,
                styles: {
                  fontSize: 9,
                  cellPadding: 4,
                  overflow: 'linebreak',
                  textColor: colors.text as any,
                  lineColor: colors.line as any,
                  lineWidth: 0.8,
                },
                columnStyles: { 0: { cellWidth: 170, fontStyle: 'bold' } },
                alternateRowStyles: { fillColor: colors.zebra as any },
                showHead: 'never',
                didParseCell: (cell) => {
                  if (cell.section !== 'body') return;
                  if (cell.column.index !== 1) return;
                  const raw = Array.isArray(cell.row.raw) ? cell.row.raw : [];
                  const label = String(raw[0] ?? '').trim();
                  if (
                    label === 'Objetivo' ||
                    label === 'Descripción' ||
                    label === 'DescripciÇün' ||
                    label === 'Resultados'
                  ) {
                    cell.cell.styles.halign = 'justify';
                  }
                },
              });

              y = (doc as any).lastAutoTable?.finalY + 10 || y + 10;

              y = this.renderListSection(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Unidades',
                ['Código', 'Unidad'],
                data.unidades,
                (u: any) => [
                  this.safe(this.getUnidadCodigo(u)),
                  this.safe(this.getUnidadNombre(u)),
                ],
                colors,
              );

              y = this.renderListSection(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Responsables',
                ['RUT', 'Nombre', 'Tipo'],
                data.responsables,
                (r: any) => [
                  this.safe(this.getResponsableRut(r)),
                  this.safe(this.getResponsableNombre(r)),
                  this.safe(this.getResponsableTipo(r)),
                ],
                colors,
              );

              y = this.renderListSection(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Equipo de trabajo',
                ['RUT', 'Nombre', 'Tipo'],
                data.equipoTrabajo,
                (e: any) => [
                  this.safe(this.getEquipoRut(e)),
                  this.safe(this.getEquipoNombre(e)),
                  this.safe(this.getEquipoTipo(e)),
                ],
                colors,
              );

              y = this.renderListSection(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Financiamiento',
                ['Categoría', 'Tipo', 'Monto'],
                this.withFinanciamientoTotal(data.financiamientos),
                (f: any) => [
                  this.safe(f?.categoria ?? f?.finCategoria),
                  this.safe(f?.tipoFinanciamiento ?? f?.tipo),
                  this.formatMoney(f?.monto ?? f?.finMonto),
                ],
                colors,
              );

              y = this.renderListSection(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Centros de costo',
                ['Tipo'],
                data.centrosCosto,
                (c: any) => [this.safe(c?.tipo ?? c?.nombre)],
                colors,
              );

              y = this.renderListSection(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Instituciones',
                ['Tipo', 'Nombre'],
                data.instituciones,
                (i: any) => [this.safe(i?.tipo), this.safe(i?.nombre)],
                colors,
              );

              y = this.renderListSectionWithLinks(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Difusión',
                ['Medio', 'URL'],
                data.difusiones,
                (d: any) => [this.safe(d?.medio ?? d?.difusionEquipo), this.safe(d?.url ?? d?.difusionUrl)],
                (d: any, colIndex: number) =>
                  colIndex === 1 ? this.normalizeLinkUrl(d?.url ?? d?.difusionUrl) : null,
                colors,
              );

              const singleDifusionRows = this.buildDifusionRows(data);
              if (singleDifusionRows.length) {
                const medioRow = singleDifusionRows.find(
                  (row: any) => Array.isArray(row) && row[0] === 'Medio',
                );
                const urlRow = singleDifusionRows.find(
                  (row: any) => Array.isArray(row) && row[0] === 'URL',
                );
                const medio = Array.isArray(medioRow) ? medioRow[1] : null;
                const url = Array.isArray(urlRow) ? urlRow[1] : null;

                y = this.renderListSectionWithLinks(
                  doc,
                  y,
                  margin,
                  top,
                  bottom,
                  pageHeight,
                  contentW,
                  'Difusión',
                  ['Medio', 'URL'],
                  [{ medio, url }],
                  (d: any) => [this.safe(d?.medio), this.safe(d?.url)],
                  (d: any, colIndex: number) => (colIndex === 1 ? this.normalizeLinkUrl(d?.url) : null),
                  colors,
                );
              }

              y = this.renderListSection(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Estudiantes',
                ['RUT', 'Nombre'],
                data.estudiantes,
                (e: any) => [this.safe(e?.rut), this.safe(e?.nombre)],
                colors,
              );

              y = this.renderKeyValueSectionWithUrlStyle(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Impacto',
                [
                  ['Medida', this.safe(data.impacto?.medidaImpacto ?? data.base?.medidaImpacto)],
                  ['Porcentaje de satisfacción', this.safe(data.impacto?.indicadorImpacto ?? data.base?.indicadorImpacto)],
                ],
                colors,
              );

              y = this.renderKeyValueSection(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Evidencias',
                [
                  ['Lista asistencia', this.safe(data.evidencias?.listaAsistenciaRef)],
                  ['Documentos', this.safe(data.evidencias?.documentosRef)],
                  ['Fotos', this.safe(data.evidencias?.fotosRef)],
                  ['Enlace noticia', this.safe(data.evidencias?.enlaceNoticia)],
                  ['Observaciones', this.safe(data.evidencias?.observaciones)],
                ],
                colors,
              );

              const participantesTable = this.buildParticipantesTableWithTotal(data);
              if (participantesTable.length) {
                y = this.renderListSection(
                  doc,
                  y,
                  margin,
                  top,
                  bottom,
                  pageHeight,
                  contentW,
                  'Participantes',
                  [
                    'Tipo participante',
                    'DIRECTIVOS (UTA)',
                    'DOCENTES (UTA)',
                    'ESTUDIANTES (UTA)',
                    'FUNCIONARIOS DE GESTIÓN (UTA)',
                    'EXALUMNOS',
                    'OTROS (EXTERNOS)',
                  ],
                  participantesTable,
                  (row: any) => row,
                  colors,
                );
              }

              y += 8;
            });

            const totalPages = (doc as any).getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
              doc.setPage(i);
              this.drawPdfHeader(doc, { ...headerData, logoLeft: logoUta, logoRight: logoFeh });
              this.drawPdfFooter(doc, i, totalPages, 'Reporte de acreditación');
            }

            doc.save(this.buildPdfFileName('reporte_acreditacion', items));
          } catch {
            this.exportError = 'Error al generar PDF.';
          }
        },
        error: () => {
          this.exportError = 'Error al exportar PDF.';
        },
      });
  }

  exportarPdfResumen(): void {
    if (this.exporting || !this.rows?.length) return;

    this.exportError = null;
    this.exporting = true;

    this.fetchDetalles(this.getSelectedIdsOrAll())
      .pipe(finalize(() => (this.exporting = false)))
      .subscribe({
        next: async (items) => {
          try {
            if (!items.length) {
              this.exportError = 'No se encontraron actividades para exportar.';
              return;
            }

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
              section: [248, 250, 252] as [number, number, number],
            };

            const generatedText = this.buildGeneratedText();
            const headerData = {
              title: 'REPORTE DE ACTIVIDADES DE VINCULACIÓN',
              subtitle: this.getFiltroYear(items),
              generatedText,
            };

            const [logoUta, logoFeh] = await Promise.all([
              this.loadLogoAsDataURLSafe('assets/img/uta.png'),
              this.loadLogoAsDataURLSafe('assets/img/feh.png'),
            ]);

            this.drawPdfHeader(doc, { ...headerData, logoLeft: logoUta, logoRight: logoFeh });

            let y = top;

            items.forEach((raw, index) => {
              const data = this.normalizeActividad(raw);
              const proyecto = data.proyecto ?? {};
              const tipoLabel = this.getTipoActividadLabel(proyecto?.tipoActividad ?? data.base?.tipoActividad);
              const fecha = this.formatearRangoFechas(
                proyecto?.fechaInicio ?? data.base?.fechaInicio,
                proyecto?.fechaTermino ?? data.base?.fechaTermino,
              );
              const descripcion = this.safe(proyecto?.descripcion ?? data.base?.descripcion);

              if (index > 0) {
                doc.addPage();
                y = top;
              }

              const rows: RowInput[] = [
                ['Nombre', this.safe(proyecto?.nombre ?? data.base?.nombre)],
                ['Tipo de vinculación', this.safe(proyecto?.tipoVinculacion ?? data.base?.tipoVinculacion)],
                ['Fecha de la actividad', fecha],
                ['Lugar', this.safe(proyecto?.lugar ?? data.base?.lugar)],
                ['Descripción', descripcion],
              ];

                y += 6;
                y = this.renderKeyValueSectionAll(
                  doc,
                  y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                '',
                rows,
                colors,
              );

              const difusionRows = this.buildDifusionRows(data).map((row) => {
                if (Array.isArray(row) && row[0] === 'Medio') {
                  return ['Tipo de medio', row[1]];
                }
                return row;
              });
              if (difusionRows.length) {
              y = this.renderKeyValueSectionWithUrlStyle(
                doc,
                y,
                margin,
                  top,
                  bottom,
                  pageHeight,
                  contentW,
                  'Difusión',
                  difusionRows,
                  colors,
                );
              }

              y = this.renderListSection(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Unidades',
                ['Código', 'Unidad'],
                data.unidades,
                (u: any) => [
                  this.safe(this.getUnidadCodigo(u)),
                  this.safe(this.getUnidadNombre(u)),
                ],
                colors,
              );

                y = this.renderListSection(
                  doc,
                  y,
                  margin,
                  top,
                  bottom,
                  pageHeight,
                  contentW,
                  'Financiamiento',
                  ['Categoría', 'Tipo', 'Monto'],
                  this.withFinanciamientoTotal(data.financiamientos),
                  (f: any) => [
                    this.safe(f?.categoria ?? f?.finCategoria),
                    this.safe(f?.tipoFinanciamiento ?? f?.tipo),
                    this.formatMoney(f?.monto ?? f?.finMonto),
                  ],
                  colors,
                );

                const evidenciaFilesRows = this.buildEvidenciasArchivosRows(data);
                if (evidenciaFilesRows.length) {
                  y = this.renderListSectionWithLinks(
                    doc,
                    y,
                    margin,
                    top,
                    bottom,
                    pageHeight,
                    contentW,
                    'Evidencias adjuntas',
                    ['Tipo', 'Nombre'],
                    evidenciaFilesRows,
                    (e: any) => [this.safe(e?.tipo), this.safe(e?.nombre)],
                    (e: any, colIndex: number) => (colIndex === 1 ? this.normalizeLinkUrl(e?.url) : null),
                    colors,
                  );
                }

                const participantesTable = this.buildParticipantesTableWithTotal(data);
                if (participantesTable.length) {
                  y = this.renderListSection(
                    doc,
                    y,
                  margin,
                  top,
                  bottom,
                  pageHeight,
                  contentW,
                  'Participantes',
                  [
                    'Tipo participante',
                    'DIRECTIVOS (UTA)',
                    'DOCENTES (UTA)',
                    'ESTUDIANTES (UTA)',
                    'FUNCIONARIOS DE GESTIÓN (UTA)',
                    'EXALUMNOS',
                    'OTROS (EXTERNOS)',
                  ],
                  participantesTable,
                  (row: any) => row,
                  colors,
                );
              }

              y += 6;
            });

            const totalPages = (doc as any).getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
              doc.setPage(i);
              this.drawPdfHeader(doc, { ...headerData, logoLeft: logoUta, logoRight: logoFeh });
              this.drawPdfFooter(doc, i, totalPages, 'Reporte de actividades de vinculación');
            }

            doc.save(this.buildPdfFileName('reporte_vinculacion', items));
          } catch {
            this.exportError = 'Error al generar PDF.';
          }
        },
        error: () => {
          this.exportError = 'Error al exportar PDF.';
        },
      });
  }
  exportarExcel(): void {
    if (this.exporting || !this.rows?.length) return;

    this.exportError = null;
    this.exporting = true;

    this.fetchDetalles(this.getSelectedIdsOrAll())
      .pipe(finalize(() => (this.exporting = false)))
      .subscribe({
        next: (items) => {
          try {
            if (!items.length) {
              this.exportError = 'No se encontraron actividades para exportar.';
              return;
            }

            const rows = items.map((raw) => {
              const data = this.normalizeActividad(raw);
              const proyecto = data.proyecto ?? {};

              const participantesCols = this.buildParticipantesExcelCols(data);

              return {
                Nombre: this.excelText(proyecto.nombre ?? data.base?.nombre),
                Tipo: this.excelText(this.getTipoActividadLabel(proyecto.tipoActividad ?? data.base?.tipoActividad)),
                'Tipo vinculación': this.excelText(proyecto.tipoVinculacion ?? data.base?.tipoVinculacion),
                'Tipo vinculación otro': this.excelText(proyecto.tipoVinculacionOtro ?? data.base?.tipoVinculacionOtro),
                'Área vinculación': this.excelText(proyecto.areaVinculacion ?? data.base?.areaVinculacion),
                'Area impacto': this.excelText(proyecto.areaImpacto ?? data.base?.areaImpacto),
                'Fecha inicio': this.formatDate(proyecto.fechaInicio ?? data.base?.fechaInicio),
                'Fecha termino': this.formatDate(proyecto.fechaTermino ?? data.base?.fechaTermino),
                Sede: this.excelText(proyecto.sede ?? data.base?.sede),
                Lugar: this.excelText(proyecto.lugar ?? data.base?.lugar),
                'Proyecto asociado': this.excelText(
                  proyecto.proyectoAsociado ?? proyecto.proyecto ?? data.base?.proyectoAsociado ?? data.base?.proyecto,
                ),
                Objetivo: this.excelText(proyecto.objetivo ?? data.base?.objetivo),
                Descripcion: this.excelText(proyecto.descripcion ?? data.base?.descripcion),
                Resultados: this.excelText(proyecto.resultados ?? data.base?.resultados),
                Unidades: this.excelText(
                  this.joinList(data.unidades, (u: any) =>
                    [this.getUnidadCodigo(u), this.getUnidadNombre(u)].filter(Boolean).join(' - '),
                  ),
                ),
                Responsables: this.excelText(
                  this.joinList(data.responsables, (r: any) =>
                    [this.getResponsableRut(r), this.getResponsableNombre(r), this.getResponsableTipo(r)]
                      .filter(Boolean)
                      .join(' - '),
                  ),
                ),
                'Equipo trabajo': this.excelText(
                  this.joinList(data.equipoTrabajo, (e: any) =>
                    [this.getEquipoRut(e), this.getEquipoNombre(e), this.getEquipoTipo(e)]
                      .filter(Boolean)
                      .join(' - '),
                  ),
                ),
                Financiamiento: this.excelText(
                  this.joinList(data.financiamientos, (f: any) =>
                    [f?.categoria ?? f?.finCategoria, f?.tipoFinanciamiento ?? f?.tipo, f?.monto ?? f?.finMonto]
                      .filter((x) => x !== undefined && x !== null && x !== '')
                      .join(' - '),
                  ),
                ),
                'Financiamiento total': this.getFinanciamientoTotal(data.financiamientos),
                'Centros costo': this.excelText(
                  this.joinList(data.centrosCosto, (c: any) => String(c?.tipo ?? c?.nombre ?? '-')),
                ),
                Instituciones: this.excelText(
                  this.joinList(data.instituciones, (i: any) =>
                    [i?.tipo, i?.nombre].filter(Boolean).join(' - '),
                  ),
                ),
                Difusion: this.excelText(
                  this.joinList(data.difusiones, (d: any) =>
                    [d?.medio ?? d?.difusionEquipo, d?.url ?? d?.difusionUrl].filter(Boolean).join(' - '),
                  ),
                ),
                'Difusión (medio)': this.excelText(
                  proyecto.difusion?.medio ??
                    proyecto.difusion?.difusionEquipo ??
                    data.base?.medioDifusion ??
                    data.base?.difusion?.medio ??
                    data.base?.difusion?.difusionEquipo,
                ),
                'Difusión (url)': this.excelText(
                  proyecto.difusion?.url ??
                    proyecto.difusion?.difusionUrl ??
                    data.base?.urlDifusion ??
                    data.base?.difusion?.url ??
                    data.base?.difusion?.difusionUrl,
                ),
                Estudiantes: this.excelText(
                  this.joinList(data.estudiantes, (e: any) => [e?.rut, e?.nombre].filter(Boolean).join(' - ')),
                ),
                ...participantesCols,
                Impacto: this.excelText(
                  JSON.stringify({
                    medidaImpacto: data.impacto?.medidaImpacto ?? data.base?.medidaImpacto ?? null,
                    indicadorImpacto: data.impacto?.indicadorImpacto ?? data.base?.indicadorImpacto ?? null,
                  }),
                ),
                Evidencias: this.excelText(JSON.stringify(data.evidencias ?? {})),
                'Resumen IA': this.excelText(data.base?.resumenIa ?? ''),
                'Evidencias adjuntas': this.excelText(
                  this.joinList(data.archivosEvidencia, (a: any) =>
                    [a?.tipo, a?.nombre, a?.url].filter(Boolean).join(' - '),
                  ),
                ),
              };
            });

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Actividades');

            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
            saveAs(blob, 'reporte_actividades_vinculacion.xlsx');
          } catch {
            this.exportError = 'Error al exportar Excel.';
          }
        },
        error: () => {
          this.exportError = 'Error al exportar Excel.';
        },
      });
  }

  private fetchDetalles(selectedIds?: number[]) {
    const ids = (selectedIds ?? (this.rows ?? []).map((r) => r?.id))
      .map((id) => Number(id))
      .filter((id) => !Number.isNaN(id));
    if (!ids.length) return of<any[]>([]);

    return forkJoin(
      ids.map((id) =>
        this.api.obtener(id).pipe(
          map((x) => x ?? null),
          catchError(() => of(null)),
        ),
      ),
    ).pipe(map((items) => items.filter((x): x is any => !!x)));
  }

  private normalizeActividad(raw: any) {
    const base = raw ?? {};
    const root = base?.payload ?? base ?? {};
    const proyecto = root?.proyecto ?? base?.proyecto ?? {};

    return {
      base,
      proyecto,
      evidencias: root?.evidencias ?? base?.evidencias ?? {},
      participantes: root?.participantes ?? base?.participantes ?? {},
      impacto: root?.impacto ?? base?.impacto ?? {},
      difusion: root?.difusion ?? base?.difusion ?? {},
      archivosEvidencia: base?.archivosEvidencia ?? root?.archivosEvidencia ?? [],
      unidades: base?.unidades ?? root?.unidades ?? [],
      responsables: base?.responsables ?? root?.responsables ?? [],
      equipoTrabajo:
        base?.equiposTrabajo ??
        root?.equiposTrabajo ??
        base?.equipoTrabajo ??
        root?.equipoTrabajo ??
        [],
      financiamientos: base?.financiamientos ?? root?.financiamientos ?? [],
      centrosCosto: base?.centrosCosto ?? root?.centrosCosto ?? [],
      difusiones: base?.difusiones ?? root?.difusiones ?? [],
      instituciones: base?.instituciones ?? root?.instituciones ?? [],
      estudiantes: base?.estudiantes ?? root?.estudiantes ?? [],
      matricesParticipantes: base?.matricesParticipantes ?? root?.matricesParticipantes ?? [],
    };
  }

  private buildGeneralRows(data: any): RowInput[] {
    const p = data.proyecto ?? {};
      const rows: RowInput[] = [
        ['Nombre', this.safe(p?.nombre ?? data.base?.nombre)],
        ['Tipo de actividad', this.getTipoActividadLabel(p?.tipoActividad ?? data.base?.tipoActividad)],
        ['Objetivo', this.safe(p?.objetivo ?? data.base?.objetivo)],
      ['Descripción', this.safe(p?.descripcion ?? data.base?.descripcion)],
      ['Tipo vinculación', this.safe(p?.tipoVinculacion ?? data.base?.tipoVinculacion)],
      ['Tipo vinculación otro', this.safe(p?.tipoVinculacionOtro ?? data.base?.tipoVinculacionOtro)],
      ['Área vinculación', this.safe(p?.areaVinculacion ?? data.base?.areaVinculacion)],
      ['Área impacto', this.safe(p?.areaImpacto ?? data.base?.areaImpacto)],
      ['Fecha inicio', this.formatDate(p?.fechaInicio ?? data.base?.fechaInicio)],
      ['Fecha término', this.formatDate(p?.fechaTermino ?? data.base?.fechaTermino)],
      ['Sede', this.safe(p?.sede ?? data.base?.sede)],
      ['Lugar', this.safe(p?.lugar ?? data.base?.lugar)],
      ['Proyecto asociado', this.safe(p?.proyectoAsociado ?? p?.proyecto ?? data.base?.proyectoAsociado ?? data.base?.proyecto)],
      ['Resultados', this.safe(p?.resultados ?? data.base?.resultados)],
    ];

    const extras = [
      ['Institución visitada', p?.feriaInstitucionVisitada],
      ['Estudiante feria RUT', p?.feriaEstRut],
      ['Estudiante feria nombre', p?.feriaEstNombre],
      ['Tema central', p?.jornadaTemaCentral],
      ['Talleres', p?.jornadaTalleres],
      ['Responsable taller', p?.jornadaResponsableTaller],
      ['Asignatura', p?.tallerAsignatura],
      ['Competencia', p?.tallerCompetencia],
      ['Estudiantes beneficiados', p?.tallerNombreEstudiantesBeneficiados],
      ['Evento', p?.congresoNombreEvento],
      ['Ponencia', p?.congresoPonenciaPresentada],
      ['Relator', p?.congresoRelator],
      ['Colegio asociado', p?.alternanciaColegioAsociado],
      ['Docente colaborador', p?.alternanciaDocenteColaborador],
      ['Asignatura alternancia', p?.alternanciaAsignatura],
      ['Curso', p?.alternanciaCurso],
      ['Docente asignatura', p?.alternanciaDocenteAsignatura],
      ['Estudiantes participantes', p?.alternanciaEstudiantesParticipantes],
      ['Nombre actividad', p?.alternanciaNombreActividad],
      ['Objetivo pedagógico', p?.salidaObjetivoPedagogico],
      ['Asignatura vinculada', p?.salidaAsignaturaVinculada],
      ['Profesor responsable', p?.salidaProfesorResponsable],
      ['Estudiante salida RUT', p?.salidaEstRut],
      ['Estudiante salida nombre', p?.salidaEstNombre],
    ];

    for (const [label, value] of extras) {
      if (value !== null && value !== undefined && value !== '') {
        rows.push([label, this.safe(value)]);
      }
    }

    return rows;
  }

  private buildParticipantesTable(data: any): RowInput[] {
    const matrices = Array.isArray(data.matricesParticipantes) ? data.matricesParticipantes : [];
    if (matrices.length) {
      return matrices.map((m: any) => this.mapMatrizToRow(m));
    }

    const participantes = data.participantes ?? {};
    if (!participantes || typeof participantes !== 'object') return [];

    const rowsByTipo: Record<string, any> = {};
    for (const [key, value] of Object.entries(participantes)) {
      if (!key.includes('__')) continue;
      const [tipoRaw, campoRaw] = key.split('__');
      const tipo = String(tipoRaw || '').toUpperCase();
      const campo = String(campoRaw || '').toUpperCase();
      rowsByTipo[tipo] = rowsByTipo[tipo] || { tipoParticipante: tipo };
      rowsByTipo[tipo][campo] = value;
    }

    const rows: RowInput[] = [];
    for (const row of Object.values(rowsByTipo)) {
      rows.push(this.mapParticipantesRow(row));
    }

    return rows;
  }

  private buildParticipantesTableWithTotal(data: any): RowInput[] {
    const rows = this.buildParticipantesTable(data);
    if (!rows.length) return rows;

    let total = 0;
    rows.forEach((row) => {
      if (!Array.isArray(row)) return;
      for (let i = 1; i <= 6; i += 1) {
        const value = Number(row[i]);
        if (!Number.isNaN(value)) total += value;
      }
    });

    const totalRow: RowInput = [
      'Total participantes',
      this.safe(total),
      '-',
      '-',
      '-',
      '-',
      '-',
    ];

    return [...rows, totalRow];
  }

  private buildDifusionRows(data: any): RowInput[] {
    const difusion = data.difusion ?? {};
    const rows: RowInput[] = [];

    const medio =
      difusion?.medio ??
      difusion?.difusionEquipo ??
      data.base?.medioDifusion ??
      data.base?.difusion?.medio ??
      data.base?.difusion?.difusionEquipo;

    const url =
      difusion?.url ??
      difusion?.difusionUrl ??
      data.base?.urlDifusion ??
      data.base?.difusion?.url ??
      data.base?.difusion?.difusionUrl;

    if (medio) rows.push(['Medio', this.safe(medio)]);
    if (url) rows.push(['URL', this.safe(url)]);

    return rows;
  }

  private buildEvidenciasArchivosRows(data: any): Array<{ tipo: string; nombre: string; url: string | null }> {
    const archivos = data.archivosEvidencia ?? [];
    if (!Array.isArray(archivos) || archivos.length === 0) return [];

    return archivos.map((a: any) => ({
      tipo: this.safe(this.formatEvidenciaTipo(a?.tipo)),
      nombre: this.safe(a?.nombre ?? a?.url),
      url: a?.url ? String(a.url) : null,
    }));
  }

  private formatEvidenciaTipo(raw: any): string {
    const value = String(raw ?? '').trim();
    if (!value) return 'Archivo';
    switch (value.toUpperCase()) {
      case 'LISTA_ASISTENCIA':
        return 'Lista asistencia';
      case 'DOCUMENTO':
        return 'Documento';
      case 'FOTOGRAFIA':
        return 'Fotografía';
      default: {
        const normalized = value.replace(/_/g, ' ').toLowerCase();
        return normalized.replace(/\b[a-z]/g, (char) => char.toUpperCase());
      }
    }
  }

  private renderListSection(
    doc: jsPDF,
    y: number,
    margin: number,
    top: number,
    bottom: number,
    pageHeight: number,
    contentW: number,
    title: string,
    head: string[],
    items: any[],
    mapRow: (item: any) => RowInput,
    colors: {
      text: [number, number, number];
      line: [number, number, number];
      border: [number, number, number];
      tableHead: [number, number, number];
      zebra: [number, number, number];
    },
  ): number {
    if (!items || items.length === 0) return y;
    const sectionGap = 14;

    if (y > pageHeight - bottom - 40) {
      doc.addPage();
      y = top;
    }

    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(title, margin, y);
      y += 6;
    }

    const headNormalized = head.map((h) => this.normalizeTableText(h));
    const bodyNormalized = items.map(mapRow).map((row) => this.normalizeTableRow(row));
    const normalizedTitle = String(title ?? '').trim().toLowerCase();
    const totalRowIndex =
      normalizedTitle === 'participantes'
        ? bodyNormalized.findIndex(
            (row) =>
              Array.isArray(row) &&
              String(row[0] ?? '')
                .trim()
                .toLowerCase() === 'total participantes',
          )
        : normalizedTitle === 'financiamiento'
          ? bodyNormalized.findIndex(
              (row) =>
                Array.isArray(row) &&
                String(row[0] ?? '')
                  .trim()
                  .toLowerCase() === 'total',
            )
          : -1;

    autoTable(doc, {
      startY: y,
      head: [headNormalized],
      body: bodyNormalized,
      margin: { left: margin, right: margin, top, bottom },
      tableWidth: contentW,
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: colors.text as any,
        lineColor: colors.line as any,
        lineWidth: 0.8,
      },
      headStyles: {
        fillColor: colors.tableHead as any,
        textColor: colors.text as any,
        fontStyle: 'bold',
        lineColor: colors.border as any,
        lineWidth: 1,
      },
      didParseCell: (data) => {
        if (totalRowIndex < 0) return;
        if (data.section !== 'body') return;
        if (data.row.index !== totalRowIndex) return;
        data.cell.styles.fontStyle = 'bold';
      },
    alternateRowStyles: { fillColor: colors.zebra as any },
  });

  return (doc as any).lastAutoTable?.finalY + sectionGap || y + sectionGap;
  }

  private renderListSectionWithLinks(
    doc: jsPDF,
    y: number,
    margin: number,
    top: number,
    bottom: number,
    pageHeight: number,
    contentW: number,
    title: string,
    head: string[],
    items: any[],
    mapRow: (item: any) => RowInput,
    linkResolver: (item: any, colIndex: number) => string | null,
    colors: {
      text: [number, number, number];
      line: [number, number, number];
      border: [number, number, number];
      tableHead: [number, number, number];
      zebra: [number, number, number];
    },
  ): number {
    if (!items || items.length === 0) return y;
    const sectionGap = 14;

    if (y > pageHeight - bottom - 40) {
      doc.addPage();
      y = top;
    }

    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(title, margin, y);
      y += 6;
    }

    const headNormalized = head.map((h) => this.normalizeTableText(h));
    const bodyNormalized = items.map(mapRow).map((row) => this.normalizeTableRow(row));

    autoTable(doc, {
      startY: y,
      head: [headNormalized],
      body: bodyNormalized,
      margin: { left: margin, right: margin, top, bottom },
      tableWidth: contentW,
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: colors.text as any,
        lineColor: colors.line as any,
        lineWidth: 0.8,
      },
      headStyles: {
        fillColor: colors.tableHead as any,
        textColor: colors.text as any,
        fontStyle: 'bold',
        lineColor: colors.border as any,
        lineWidth: 1,
      },
      alternateRowStyles: { fillColor: colors.zebra as any },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const item = items[data.row.index];
        const url = linkResolver(item, data.column.index);
        if (url) data.cell.styles.textColor = [37, 99, 235];
      },
      didDrawCell: (data) => {
        if (data.section !== 'body') return;
        const item = items[data.row.index];
        const url = linkResolver(item, data.column.index);
        if (!url) return;
        doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
      },
    });

    return (doc as any).lastAutoTable?.finalY + sectionGap || y + sectionGap;
  }

  private normalizeLinkUrl(raw?: string | null): string | null {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (!trimmed || trimmed === '-') return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    const origin = this.apiBaseUrl.replace(/\/$/, '');
    if (trimmed.startsWith('/')) return `${origin}${trimmed}`;
    return `${origin}/${trimmed}`;

    return trimmed;
  }

  private renderKeyValueSectionWithUrlStyle(
    doc: jsPDF,
    y: number,
    margin: number,
    top: number,
    bottom: number,
    pageHeight: number,
    contentW: number,
    title: string,
    rows: RowInput[],
    colors: {
      text: [number, number, number];
      line: [number, number, number];
      border: [number, number, number];
      tableHead: [number, number, number];
      zebra: [number, number, number];
    },
  ): number {
    const sectionGap = 14;
    const filtered = rows.filter((r) => {
      const value = Array.isArray(r) ? r[1] : null;
      return value !== null && value !== undefined && value !== '' && value !== '-';
    });

    if (!filtered.length) return y;

    if (y > pageHeight - bottom - 40) {
      doc.addPage();
      y = top;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, margin, y);
    y += 6;

    const bodyNormalized = filtered.map((row) => this.normalizeTableRow(row));

    autoTable(doc, {
      startY: y,
      body: bodyNormalized,
      margin: { left: margin, right: margin, top, bottom },
      tableWidth: contentW,
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        textColor: colors.text as any,
        lineColor: colors.line as any,
        lineWidth: 0.8,
      },
      columnStyles: { 0: { cellWidth: 170, fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: colors.zebra as any },
      showHead: 'never',
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        if (data.column.index !== 1) return;
        const row = filtered[data.row.index];
        if (!Array.isArray(row)) return;
        const label = String(row[0] ?? '').trim().toUpperCase();
        if (label !== 'URL') return;
        const raw = row[1];
        const normalized = this.normalizeLinkUrl(typeof raw === 'string' ? raw : String(raw ?? ''));
        if (normalized) data.cell.styles.textColor = [37, 99, 235];
      },
      didDrawCell: (data) => {
        if (data.section !== 'body') return;
        if (data.column.index !== 1) return;
        const row = filtered[data.row.index];
        if (!Array.isArray(row)) return;
        const label = String(row[0] ?? '').trim().toUpperCase();
        if (label !== 'URL') return;
        const raw = row[1];
        const normalized = this.normalizeLinkUrl(typeof raw === 'string' ? raw : String(raw ?? ''));
        if (!normalized) return;
        doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: normalized });
      },
    });

    return (doc as any).lastAutoTable?.finalY + sectionGap || y + sectionGap;
  }

  private renderKeyValueSectionAll(
    doc: jsPDF,
    y: number,
    margin: number,
    top: number,
    bottom: number,
    pageHeight: number,
    contentW: number,
    title: string,
    rows: RowInput[],
    colors: {
      text: [number, number, number];
      line: [number, number, number];
      border: [number, number, number];
      tableHead: [number, number, number];
      zebra: [number, number, number];
    },
  ): number {
    const sectionGap = 14;

    if (y > pageHeight - bottom - 40) {
      doc.addPage();
      y = top;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, margin, y);
    y += 6;

    const bodyNormalized = rows.map((row) => this.normalizeTableRow(row));

    autoTable(doc, {
      startY: y,
      body: bodyNormalized,
      margin: { left: margin, right: margin, top, bottom },
      tableWidth: contentW,
      styles: {
        fontSize: 9,
        cellPadding: 4,
        overflow: 'linebreak',
        textColor: colors.text as any,
        lineColor: colors.line as any,
        lineWidth: 0.8,
      },
      columnStyles: { 0: { cellWidth: 170, fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: colors.zebra as any },
      showHead: 'never',
      didParseCell: (cell) => {
        if (cell.section !== 'body') return;
        if (cell.column.index !== 1) return;
        const row = rows[cell.row.index];
        if (!Array.isArray(row)) return;
        const label = String(row[0] ?? '').trim();
        const labelNorm = label
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();
        if (labelNorm === 'DESCRIPCION') {
          cell.cell.styles.halign = 'justify';
        }
      },
    });

    return (doc as any).lastAutoTable?.finalY + sectionGap || y + sectionGap;
  }
  private renderKeyValueSection(
    doc: jsPDF,
    y: number,
    margin: number,
    top: number,
    bottom: number,
    pageHeight: number,
    contentW: number,
    title: string,
    rows: RowInput[],
    colors: {
      text: [number, number, number];
      line: [number, number, number];
      border: [number, number, number];
      tableHead: [number, number, number];
      zebra: [number, number, number];
    },
  ): number {
    const sectionGap = 14;
    const filtered = rows.filter((r) => {
      const value = Array.isArray(r) ? r[1] : null;
      return value !== null && value !== undefined && value !== '' && value !== '-';
    });

    if (!filtered.length) return y;

    if (y > pageHeight - bottom - 40) {
      doc.addPage();
      y = top;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, margin, y);
    y += 6;

    const bodyNormalized = filtered.map((row) => this.normalizeTableRow(row));

    autoTable(doc, {
      startY: y,
      body: bodyNormalized,
      margin: { left: margin, right: margin, top, bottom },
      tableWidth: contentW,
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        textColor: colors.text as any,
        lineColor: colors.line as any,
        lineWidth: 0.8,
      },
      columnStyles: { 0: { cellWidth: 170, fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: colors.zebra as any },
      showHead: 'never',
    });

    return (doc as any).lastAutoTable?.finalY + sectionGap || y + sectionGap;
  }

  private async loadImageAsDataURLSafe(path: string): Promise<string | null> {
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await this.blobToJpegDataUrl(blob, 0.75);
    } catch {
      return null;
    }
  }

  private async loadLogoAsDataURLSafe(path: string): Promise<string | null> {
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await this.blobToPngDataUrl(blob, 256);
    } catch {
      return null;
    }
  }

  private blobToJpegDataUrl(blob: Blob, quality: number): Promise<string | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  private blobToPngDataUrl(blob: Blob, maxWidth: number): Promise<string | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const naturalW = img.naturalWidth || img.width;
        const naturalH = img.naturalHeight || img.height;
        const scale = naturalW > maxWidth ? maxWidth / naturalW : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(naturalW * scale));
        canvas.height = Math.max(1, Math.round(naturalH * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  private drawPdfHeader(
    doc: jsPDF,
    opts: {
      title: string;
      subtitle: string;
      generatedText: string;
      logoLeft?: string | null;
      logoRight?: string | null;
    },
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
      const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(dataUrl, format, x, y, w, h);
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

  private buildGeneratedText(): string {
    return `Fecha: ${formatDateEs(new Date())}`;
  }

  private buildPdfFileName(base: string, items: any[]): string {
    const ids: string[] = [];
    for (const raw of items ?? []) {
      const data = this.normalizeActividad(raw);
      const id = data.base?.id ?? data.proyecto?.id;
      if (id !== null && id !== undefined && id !== '') ids.push(String(id));
    }
    const suffix =
      ids.length === 1
        ? this.sanitizeFileName(ids[0])
        : ids.length > 1
          ? 'varias_actividades'
          : '';
    return suffix ? `${base}_${suffix}.pdf` : `${base}.pdf`;
  }

  private sanitizeFileName(value: string): string {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return '';
    return trimmed
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 80);
  }

  private formatMoney(value: any): string {
    if (value === null || value === undefined || value === '') return '-';
    const n = Number(value);
    if (Number.isNaN(n)) return this.safe(value);
    return new Intl.NumberFormat('es-CL').format(n);
  }

  private getFiltroYear(items: any[]): string {
    const startYear = this.extractYear(this.filtroForm?.value?.fechaInicio);
    const endYear = this.extractYear(this.filtroForm?.value?.fechaTermino);

    if (startYear || endYear) {
      if (startYear && endYear) {
        return startYear == endYear ? String(startYear) : `${startYear}-${endYear}`;
      }
      return String(startYear ?? endYear);
    }

    const years = new Set<number>();
    for (const raw of items ?? []) {
      const data = this.normalizeActividad(raw);
      const proyecto = data.proyecto ?? {};
      const year = this.extractYear(proyecto?.fechaInicio ?? data.base?.fechaInicio);
      if (year) years.add(year);
    }

    if (!years.size) return '-';
    const sorted = Array.from(years).sort((a, b) => a - b);
    if (sorted.length == 1) return String(sorted[0]);
    return `${sorted[0]}-${sorted[sorted.length - 1]}`;
  }

  private extractYear(value: any): number | null {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const datePart = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
    const match = /^\d{4}/.exec(datePart);
    if (match) return Number(match[0]);
    const parsed = parseDateFlexible(trimmed);
    return parsed ? parsed.getFullYear() : null;
  }

  private drawPdfFooter(doc: jsPDF, page: number, totalPages: number, title: string) {
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

    doc.text(`Gestión Académica | ${title}`, margin, pageHeight - 18);
    doc.text(`Página ${page} / ${totalPages}`, pageWidth - margin, pageHeight - 18, {
      align: 'right' as any,
    });
  }

  private safeDateParam(value: any): string | undefined {
    if (!value) return undefined;
    const raw = String(value).trim();
    return raw.length ? raw : undefined;
  }

  private getSelectedIdsOrAll(): number[] {
    if (this.selectedIds.size) return Array.from(this.selectedIds);
    return (this.rows ?? []).map((r) => Number(r?.id)).filter((id) => !Number.isNaN(id));
  }

  private formatDate(value?: string | null): string {
    if (!value) return '-';
    const parsed = parseDateFlexible(value);
    return parsed ? formatDateEs(parsed) : String(value);
  }

  private excelText(value: any): string {
    const safe = this.safe(value);
    return this.normalizeTableText(safe);
  }

  private normalizeTableRow(row: RowInput): RowInput {
    if (!Array.isArray(row)) return row;
    return row.map((cell) => this.normalizeTableText(cell));
  }

  private normalizeTableText(value: any): any {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    const upper = trimmed.toUpperCase();
    const lower = trimmed.toLowerCase();
    if (trimmed === upper && trimmed !== lower) {
      let result = lower;
      const allowedAcronyms = new Set([
        'UTA',
        'RUT',
        'PDF',
        'PM',
        'VCM',
      ]);
      const acronyms = trimmed.match(/\b[A-Z]{2,3}\b/g) ?? [];
      for (const token of acronyms) {
        if (!allowedAcronyms.has(token)) continue;
        const tokenLower = token.toLowerCase();
        const re = new RegExp(`\\b${tokenLower}\\b`, 'g');
        result = result.replace(re, token);
      }

      result = result.replace(
        /(^[^a-zA-ZÁÉÍÓÚÜÑáéíóúüñ]*)([a-zA-ZÁÉÍÓÚÜÑáéíóúüñ])/,
        (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`,
      );

      return result;
    }
    return value;
  }

  private safe(value: any): string {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  }

  private getUnidadCodigo(unidad: any): string | null {
    if (!unidad) return null;
    const nested = unidad?.unidad;
    return (
      unidad?.cod ??
      unidad?.codigo ??
      (typeof nested === 'object' ? nested?.codigo : null) ??
      unidad?.unidadCodigo ??
      null
    );
  }

  private getUnidadNombre(unidad: any): string | null {
    if (!unidad) return null;
    const nested = unidad?.unidad;
    if (typeof nested === 'string') return nested;
    return (
      (typeof nested === 'object' ? nested?.nombre : null) ??
      unidad?.nombre ??
      unidad?.unidadNombre ??
      null
    );
  }

  private getResponsableRut(responsable: any): string | null {
    if (!responsable) return null;
    const nested = responsable?.responsable;
    return (
      responsable?.rut ??
      (typeof nested === 'object' ? nested?.rut : null) ??
      responsable?.responsableRut ??
      null
    );
  }

  private getResponsableNombre(responsable: any): string | null {
    if (!responsable) return null;
    const nested = responsable?.responsable;
    if (typeof nested === 'string') return nested;
    return (
      (typeof nested === 'object' ? nested?.nombre : null) ??
      responsable?.nombre ??
      responsable?.responsableNombre ??
      null
    );
  }

  private getResponsableTipo(responsable: any): string | null {
    if (!responsable) return null;
    const nested = responsable?.responsable;
    return (
      responsable?.tipo ??
      (typeof nested === 'object' ? nested?.tipo : null) ??
      responsable?.responsableTipo ??
      null
    );
  }

  private getEquipoRut(equipo: any): string | null {
    if (!equipo) return null;
    const nested = equipo?.equipoTrabajo;
    return (
      equipo?.rut ??
      (typeof nested === 'object' ? nested?.rut : null) ??
      equipo?.equipoRut ??
      null
    );
  }

  private getEquipoNombre(equipo: any): string | null {
    if (!equipo) return null;
    const nested = equipo?.equipoTrabajo;
    if (typeof nested === 'string') return nested;
    return (
      (typeof nested === 'object' ? nested?.nombre : null) ??
      equipo?.nombre ??
      equipo?.equipoNombre ??
      null
    );
  }

  private getEquipoTipo(equipo: any): string | null {
    if (!equipo) return null;
    return equipo?.tipo ?? equipo?.equipo ?? equipo?.equipoTipo ?? null;
  }

  private withFinanciamientoTotal(financiamientos: any[]): any[] {
    if (!Array.isArray(financiamientos) || financiamientos.length === 0) return [];
    let total = 0;

    financiamientos.forEach((f) => {
      const raw = f?.monto ?? f?.finMonto;
      const n = Number(raw);
      if (!Number.isNaN(n)) total += n;
    });

    return [
      ...financiamientos,
      { categoria: 'Total', tipo: '', monto: total },
    ];
  }

  private getFinanciamientoTotal(financiamientos: any[]): number | string {
    if (!Array.isArray(financiamientos) || financiamientos.length === 0) return '-';
    let total = 0;
    for (const f of financiamientos) {
      const raw = f?.monto ?? f?.finMonto;
      const n = Number(raw);
      if (!Number.isNaN(n)) total += n;
    }
    return total;
  }

  private getTotalParticipantes(data: any): number {
    const matrices = Array.isArray(data?.matricesParticipantes) ? data.matricesParticipantes : [];
    const keys = [
      'directivosUta',
      'docentesUta',
      'estudiantesUta',
      'funcionariosGestionUta',
      'exalumnos',
      'otrosExternos',
    ];

    if (matrices.length) {
      return matrices.reduce((acc: number, row: any) => {
        const subtotal = keys.reduce((sum, k) => sum + (Number(row?.[k]) || 0), 0);
        return acc + subtotal;
      }, 0);
    }

    const participantes = data?.participantes ?? {};
    if (!participantes || typeof participantes !== 'object') return 0;

    let total = 0;
    for (const [key, value] of Object.entries(participantes)) {
      if (!String(key).includes('__')) continue;
      const n = Number(value);
      if (!Number.isNaN(n)) total += n;
    }

    return total;
  }
  private mapMatrizToRow(matriz: any): RowInput {
    const tipoRaw = String(matriz?.tipoParticipante ?? '').toUpperCase();
    return this.mapParticipantesRow({
      tipoParticipante: tipoRaw,
      DIRECTIVOS_UTA: matriz?.directivosUta,
      DOCENTES_UTA: matriz?.docentesUta,
      ESTUDIANTES_UTA: matriz?.estudiantesUta,
      FUNCIONARIOS_GESTION_UTA: matriz?.funcionariosGestionUta,
      EXALUMNOS: matriz?.exalumnos,
      OTROS_EXTERNOS: matriz?.otrosExternos,
    });
  }

  private mapParticipantesRow(row: any): RowInput {
    const tipo = String(row?.tipoParticipante ?? '-').toUpperCase();
    return [
      tipo || '-',
      this.safe(row?.DIRECTIVOS_UTA ?? row?.directivosUta ?? 0),
      this.safe(row?.DOCENTES_UTA ?? row?.docentesUta ?? 0),
      this.safe(row?.ESTUDIANTES_UTA ?? row?.estudiantesUta ?? 0),
      this.safe(row?.FUNCIONARIOS_GESTION_UTA ?? row?.funcionariosGestionUta ?? 0),
      this.safe(row?.EXALUMNOS ?? row?.exalumnos ?? 0),
      this.safe(row?.OTROS_EXTERNOS ?? row?.otrosExternos ?? 0),
    ];
  }

  private buildParticipantesExcelCols(data: any): Record<string, any> {
    const cols: Record<string, any> = {
      'Asistentes - Directivos (UTA)': '-',
      'Asistentes - Docentes (UTA)': '-',
      'Asistentes - Estudiantes (UTA)': '-',
      'Asistentes - Funcionarios de gestión (UTA)': '-',
      'Asistentes - Exalumnos': '-',
      'Asistentes - Otros (externos)': '-',
      'Expositores - Directivos (UTA)': '-',
      'Expositores - Docentes (UTA)': '-',
      'Expositores - Estudiantes (UTA)': '-',
      'Expositores - Funcionarios de gestión (UTA)': '-',
      'Expositores - Exalumnos': '-',
      'Expositores - Otros (externos)': '-',
    };

    const matrices = Array.isArray(data.matricesParticipantes) ? data.matricesParticipantes : [];
    if (matrices.length) {
      const asistentes = matrices.find((m: any) => String(m?.tipoParticipante).toUpperCase() === 'ASISTENTE') ?? {};
      const expositores = matrices.find((m: any) => String(m?.tipoParticipante).toUpperCase() === 'EXPOSITOR') ?? {};

      cols['Asistentes - Directivos (UTA)'] = asistentes?.directivosUta ?? 0;
      cols['Asistentes - Docentes (UTA)'] = asistentes?.docentesUta ?? 0;
      cols['Asistentes - Estudiantes (UTA)'] = asistentes?.estudiantesUta ?? 0;
      cols['Asistentes - Funcionarios de gestión (UTA)'] = asistentes?.funcionariosGestionUta ?? 0;
      cols['Asistentes - Exalumnos'] = asistentes?.exalumnos ?? 0;
      cols['Asistentes - Otros (externos)'] = asistentes?.otrosExternos ?? 0;

      cols['Expositores - Directivos (UTA)'] = expositores?.directivosUta ?? 0;
      cols['Expositores - Docentes (UTA)'] = expositores?.docentesUta ?? 0;
      cols['Expositores - Estudiantes (UTA)'] = expositores?.estudiantesUta ?? 0;
      cols['Expositores - Funcionarios de gestión (UTA)'] = expositores?.funcionariosGestionUta ?? 0;
      cols['Expositores - Exalumnos'] = expositores?.exalumnos ?? 0;
      cols['Expositores - Otros (externos)'] = expositores?.otrosExternos ?? 0;

      return cols;
    }

    const participantes = data.participantes ?? {};
    if (!participantes || typeof participantes !== 'object') return cols;

    for (const [key, value] of Object.entries(participantes)) {
      if (!key.includes('__')) continue;
      const [tipoRaw, campoRaw] = key.split('__');
      const tipo = String(tipoRaw || '').toUpperCase();
      const campo = this.mapParticipanteField(campoRaw);
      if (!campo) continue;

      const prefix = tipo === 'EXPOSITOR' ? 'Expositores' : 'Asistentes';
      const label = this.mapParticipanteFieldLabel(campo);
      if (!label) continue;
      cols[`${prefix} - ${label}`] = value ?? 0;
    }

    return cols;
  }

  private mapParticipanteField(raw: string): string | null {
    const clean = String(raw ?? '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (clean.includes('DIRECTIVOS')) return 'DIRECTIVOS_UTA';
    if (clean.includes('DOCENTES')) return 'DOCENTES_UTA';
    if (clean.includes('ESTUDIANTES')) return 'ESTUDIANTES_UTA';
    if (clean.includes('FUNCIONARIOS') && clean.includes('GESTION')) return 'FUNCIONARIOS_GESTION_UTA';
    if (clean.includes('EXALUMNOS')) return 'EXALUMNOS';
    if (clean.includes('OTROS') && clean.includes('EXTERNOS')) return 'OTROS_EXTERNOS';
    return null;
  }

  private mapParticipanteFieldLabel(field: string): string | null {
    switch (field) {
      case 'DIRECTIVOS_UTA':
        return 'Directivos (UTA)';
      case 'DOCENTES_UTA':
        return 'Docentes (UTA)';
      case 'ESTUDIANTES_UTA':
        return 'Estudiantes (UTA)';
      case 'FUNCIONARIOS_GESTION_UTA':
        return 'Funcionarios de gestión (UTA)';
      case 'EXALUMNOS':
        return 'Exalumnos';
      case 'OTROS_EXTERNOS':
        return 'Otros (externos)';
      default:
        return null;
    }
  }

  private joinList(list: any[], mapFn: (item: any) => string): string {
    if (!Array.isArray(list) || list.length === 0) return '-';
    const mapped = list.map(mapFn).filter((x) => x && x !== '-');
    return mapped.length ? mapped.join('; ') : '-';
  }

}


