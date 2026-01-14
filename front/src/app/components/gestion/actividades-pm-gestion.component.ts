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
    MatProgressSpinnerModule
],
  templateUrl: './actividades-pm-gestion.component.html',
  styleUrls: ['./actividades-pm-gestion.component.scss'],
})
export class ActividadesPmGestionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ActividadesPmService);
  private dialog = inject(MatDialog);

  loading = false;
  errorMsg = '';

  cols = ['nombre', 'tipoActividad', 'fecha', 'sede', 'areaImpacto', 'acciones'];
  rows: any[] = [];
  exporting = false;
  exportError: string | null = null;

  filtroForm = this.fb.group({
    anio: [new Date().getFullYear()],
    tipo: [''],
    q: [''],
  });

  tipos: { value: string; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'FERIA_VOCACIONAL', label: 'Feria Vocacional' },
    { value: 'JORNADA_PEDAGOGICA', label: 'Jornada Pedagógica' },
    { value: 'TALLER_REMEDIAL', label: 'Taller Remedial' },
    { value: 'CONGRESO_ACADEMICO', label: 'Congreso Académico' },
    { value: 'ALTERNANCIA_PEDAGOGICA', label: 'Alternancia Pedagógica' },
    { value: 'SALIDA_A_TERRENO', label: 'Salida a Terreno' },
  ];

  anios = Array.from({ length: 7 }).map((_, i) => new Date().getFullYear() - i);
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

    const { anio, tipo, q } = this.filtroForm.value;

    this.api
      .listar({
        anio: anio ?? undefined,
        tipo: tipo || undefined,
        q: q || undefined,
      })
      .subscribe({
        next: (data) => {
          this.rows = data ?? [];
          this.loading = false;
        },
        error: (err) => {
          console.error(err);
          this.errorMsg = 'No se pudo cargar el listado.';
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
        anio: new Date().getFullYear(),
        tipo: '',
        q: '',
    });
  }

  trackById = (_: number, row: any) => row?.id;

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
    return `${f(inicio)} → ${f(termino)}`;
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

    this.fetchDetalles()
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

            const generatedText = `Generado: ${new Date().toLocaleString('es-CL')}`;
            const headerData = {
              title: 'REPORTE DE ACREDITACION',
              subtitle: 'Registro completo de actividades',
              generatedText,
            };

            const [logoUta, logoFeh] = await Promise.all([
              this.loadImageAsDataURLSafe('assets/img/uta.png'),
              this.loadImageAsDataURLSafe('assets/img/feh.png'),
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
              const nombre = this.safe(data.proyecto?.nombre ?? data.base?.nombre);
              const tipoLabel = this.getTipoActividadLabel(data.proyecto?.tipoActividad ?? data.base?.tipoActividad);

              if (index > 0) {
                doc.addPage();
                y = top;
              }

              ensureSpace(40);

              doc.setFillColor(colors.section[0], colors.section[1], colors.section[2]);
              doc.rect(margin, y - 12, contentW, 22, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(12);
              doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
              doc.text(`${index + 1}. ${nombre}`, margin + 8, y + 2);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(9);
              doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
              doc.text(`Tipo: ${tipoLabel}`, margin, (y += 22));

              const generalRows = this.buildGeneralRows(data);
              y += 8;
              const generalRowsNormalized = generalRows.map((row) => this.normalizeTableRow(row));

              autoTable(doc, {
                startY: y,
                head: [[this.normalizeTableText('Campo'), this.normalizeTableText('Valor')]],
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
                columnStyles: { 0: { cellWidth: 170 } },
                headStyles: {
                  fillColor: colors.tableHead as any,
                  textColor: colors.text as any,
                  fontStyle: 'bold',
                  lineColor: colors.border as any,
                  lineWidth: 1,
                },
                alternateRowStyles: { fillColor: colors.zebra as any },
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
                ['Codigo', 'Unidad'],
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
                ['Categoria', 'Tipo', 'Monto'],
                this.withFinanciamientoTotal(data.financiamientos),
                (f: any) => [
                  this.safe(f?.categoria ?? f?.finCategoria),
                  this.safe(f?.tipoFinanciamiento ?? f?.tipo),
                  this.safe(f?.monto ?? f?.finMonto),
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

              y = this.renderListSection(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Difusion',
                ['Medio', 'URL'],
                data.difusiones,
                (d: any) => [this.safe(d?.medio ?? d?.difusionEquipo), this.safe(d?.url ?? d?.difusionUrl)],
                colors,
              );

              const singleDifusionRows = this.buildDifusionRows(data);
              if (singleDifusionRows.length) {
                y = this.renderKeyValueSection(
                  doc,
                  y,
                  margin,
                  top,
                  bottom,
                  pageHeight,
                  contentW,
                  'Difusion',
                  singleDifusionRows,
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

              const evidenciaFilesRows = this.buildEvidenciasArchivosRows(data);
              if (evidenciaFilesRows.length) {
                y = this.renderKeyValueSection(
                  doc,
                  y,
                  margin,
                  top,
                  bottom,
                  pageHeight,
                  contentW,
                  'Evidencias adjuntas',
                  evidenciaFilesRows,
                  colors,
                );
              }

              y = this.renderKeyValueSection(
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
                  ['Indicador', this.safe(data.impacto?.indicadorImpacto ?? data.base?.indicadorImpacto)],
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

              const participantesTable = this.buildParticipantesTable(data);
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
                    'FUNCIONARIOS DE GESTION (UTA)',
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
              this.drawPdfFooter(doc, i, totalPages);
            }

            doc.save('reporte_acreditacion.pdf');
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

    this.fetchDetalles()
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

            const generatedText = `Generado: ${new Date().toLocaleString('es-CL')}`;
            const headerData = {
              title: 'REPORTE DE ACTIVIDADES DE VINCULACION',
              subtitle: 'Campos clave de actividades',
              generatedText,
            };

            const [logoUta, logoFeh] = await Promise.all([
              this.loadImageAsDataURLSafe('assets/img/uta.png'),
              this.loadImageAsDataURLSafe('assets/img/feh.png'),
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
              const participantes = this.getTotalParticipantes(data);
              const descripcion = this.safe(proyecto?.descripcion ?? data.base?.descripcion);

              if (index > 0) {
                doc.addPage();
                y = top;
              }

              doc.setFillColor(colors.section[0], colors.section[1], colors.section[2]);
              doc.rect(margin, y - 12, contentW, 22, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(12);
              doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
              doc.text(`Actividad ${index + 1}`, margin + 8, y + 2);

              const rows: RowInput[] = [
                ['Tipo de actividad', tipoLabel],
                ['Fecha de la actividad', fecha],
                ['Cantidad de participantes', this.safe(participantes)],
                ['Descripcion', descripcion],
              ];

              y += 18;
              y = this.renderKeyValueSectionAll(
                doc,
                y,
                margin,
                top,
                bottom,
                pageHeight,
                contentW,
                'Detalle',
                rows,
                colors,
              );

              y += 6;
            });

            const totalPages = (doc as any).getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
              doc.setPage(i);
              this.drawPdfHeader(doc, { ...headerData, logoLeft: logoUta, logoRight: logoFeh });
              this.drawPdfFooter(doc, i, totalPages);
            }

            doc.save('reporte_acreditacion_resumen.pdf');
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

    this.fetchDetalles()
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
                'Tipo vinculacion': this.excelText(proyecto.tipoVinculacion ?? data.base?.tipoVinculacion),
                'Tipo vinculacion otro': this.excelText(proyecto.tipoVinculacionOtro ?? data.base?.tipoVinculacionOtro),
                'Area vinculacion': this.excelText(proyecto.areaVinculacion ?? data.base?.areaVinculacion),
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
                'Difusion (medio)': this.excelText(
                  proyecto.difusion?.medio ??
                    proyecto.difusion?.difusionEquipo ??
                    data.base?.medioDifusion ??
                    data.base?.difusion?.medio ??
                    data.base?.difusion?.difusionEquipo,
                ),
                'Difusion (url)': this.excelText(
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

  private fetchDetalles() {
    const ids = (this.rows ?? []).map((r) => r?.id).filter((id) => id !== null && id !== undefined);
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
      ['Objetivo', this.safe(p?.objetivo ?? data.base?.objetivo)],
      ['Descripcion', this.safe(p?.descripcion ?? data.base?.descripcion)],
      ['Tipo vinculacion', this.safe(p?.tipoVinculacion ?? data.base?.tipoVinculacion)],
      ['Tipo vinculacion otro', this.safe(p?.tipoVinculacionOtro ?? data.base?.tipoVinculacionOtro)],
      ['Area vinculacion', this.safe(p?.areaVinculacion ?? data.base?.areaVinculacion)],
      ['Area impacto', this.safe(p?.areaImpacto ?? data.base?.areaImpacto)],
      ['Fecha inicio', this.formatDate(p?.fechaInicio ?? data.base?.fechaInicio)],
      ['Fecha termino', this.formatDate(p?.fechaTermino ?? data.base?.fechaTermino)],
      ['Sede', this.safe(p?.sede ?? data.base?.sede)],
      ['Lugar', this.safe(p?.lugar ?? data.base?.lugar)],
      ['Proyecto asociado', this.safe(p?.proyectoAsociado ?? p?.proyecto ?? data.base?.proyectoAsociado ?? data.base?.proyecto)],
      ['Resultados', this.safe(p?.resultados ?? data.base?.resultados)],
    ];

    const extras = [
      ['Institucion visitada', p?.feriaInstitucionVisitada],
      ['Estudiante feria RUT', p?.feriaEstRut],
      ['Estudiante feria nombre', p?.feriaEstNombre],
      ['Tema central', p?.jornadaTemaCentral],
      ['Talleres', p?.jornadaTalleres],
      ['Responsable taller', p?.jornadaResponsableTaller],
      ['Numero asistentes', p?.jornadaNumAsistentes],
      ['Nivel satisfaccion', p?.jornadaSatisfaccion],
      ['Asignatura', p?.tallerAsignatura],
      ['Competencia', p?.tallerCompetencia],
      ['Estudiantes beneficiados', p?.tallerNombreEstudiantesBeneficiados],
      ['Evento', p?.congresoNombreEvento],
      ['Ponencia', p?.congresoPonenciaPresentada],
      ['Relator', p?.congresoRelator],
      ['Numero asistentes', p?.congresoNumAsistentes],
      ['Nivel satisfaccion', p?.congresoSatisfaccion],
      ['Colegio asociado', p?.alternanciaColegioAsociado],
      ['Docente colaborador', p?.alternanciaDocenteColaborador],
      ['Asignatura alternancia', p?.alternanciaAsignatura],
      ['Curso', p?.alternanciaCurso],
      ['Docente asignatura', p?.alternanciaDocenteAsignatura],
      ['Estudiantes participantes', p?.alternanciaEstudiantesParticipantes],
      ['Nombre actividad', p?.alternanciaNombreActividad],
      ['Objetivo pedagogico', p?.salidaObjetivoPedagogico],
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

  private buildEvidenciasArchivosRows(data: any): RowInput[] {
    const archivos = data.archivosEvidencia ?? [];
    if (!Array.isArray(archivos) || archivos.length === 0) return [];

    return archivos.map((a: any) => [
      this.safe(a?.tipo ?? 'Archivo'),
      this.safe(a?.nombre ?? a?.url),
    ]);
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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, margin, y);
    y += 6;

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
      head: [[this.normalizeTableText('Campo'), this.normalizeTableText('Valor')]],
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
      columnStyles: { 0: { cellWidth: 170 } },
      headStyles: {
        fillColor: colors.tableHead as any,
        textColor: colors.text as any,
        fontStyle: 'bold',
        lineColor: colors.border as any,
        lineWidth: 1,
      },
      alternateRowStyles: { fillColor: colors.zebra as any },
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
      head: [[this.normalizeTableText('Campo'), this.normalizeTableText('Valor')]],
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
      columnStyles: { 0: { cellWidth: 170 } },
      headStyles: {
        fillColor: colors.tableHead as any,
        textColor: colors.text as any,
        fontStyle: 'bold',
        lineColor: colors.border as any,
        lineWidth: 1,
      },
      alternateRowStyles: { fillColor: colors.zebra as any },
    });

    return (doc as any).lastAutoTable?.finalY + sectionGap || y + sectionGap;
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

    doc.text('Gestion Academica | Reporte de acreditacion', margin, pageHeight - 18);
    doc.text(`Pagina ${page} / ${totalPages}`, pageWidth - margin, pageHeight - 18, {
      align: 'right' as any,
    });
  }

  private formatDate(value?: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-CL');
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
      'Asistentes - Funcionarios de gestion (UTA)': '-',
      'Asistentes - Exalumnos': '-',
      'Asistentes - Otros (externos)': '-',
      'Expositores - Directivos (UTA)': '-',
      'Expositores - Docentes (UTA)': '-',
      'Expositores - Estudiantes (UTA)': '-',
      'Expositores - Funcionarios de gestion (UTA)': '-',
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
      cols['Asistentes - Funcionarios de gestion (UTA)'] = asistentes?.funcionariosGestionUta ?? 0;
      cols['Asistentes - Exalumnos'] = asistentes?.exalumnos ?? 0;
      cols['Asistentes - Otros (externos)'] = asistentes?.otrosExternos ?? 0;

      cols['Expositores - Directivos (UTA)'] = expositores?.directivosUta ?? 0;
      cols['Expositores - Docentes (UTA)'] = expositores?.docentesUta ?? 0;
      cols['Expositores - Estudiantes (UTA)'] = expositores?.estudiantesUta ?? 0;
      cols['Expositores - Funcionarios de gestion (UTA)'] = expositores?.funcionariosGestionUta ?? 0;
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
        return 'Funcionarios de gestion (UTA)';
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


