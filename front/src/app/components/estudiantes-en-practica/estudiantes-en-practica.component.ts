import { Component, inject, OnDestroy, OnInit, PLATFORM_ID, Renderer2 } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { formatDateEs, parseDateFlexible } from '../../utils/date-utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Servicios
import {
  PracticasService,
  Estudiante,
  CentroEducativo,
  EstadoPractica,
  Colaborador,
} from '../../services/practicas.service';
import { Tutor } from '../../services/tutores.service';
import { ObservacionesService, Observacion } from '../../services/observaciones.service';

interface Actividad {
  id: number;
  titulo: string;
  descripcion?: string;
  fecha: string;
  completada: boolean;
}

interface PracticaEstudiante {
  id: number;
  estado: EstadoPractica;
  notaFinal?: number;
  fechaInicio: string;
  fechaTermino?: string;
  tipo?: string;
  anio?: number;
  semestre?: number;
  estudiante: Estudiante;
  centro: CentroEducativoPractica;
  colaboradores?: Colaborador[];
  tutores?: { tutor: Tutor; rol: string }[];
  actividades?: Actividad[];
  observaciones?: Observacion[];
}

type CentroEducativoPractica = CentroEducativo & {
  fechaInicioAsociacion?: string | null;
};

interface ReporteCentroRow {
  centro: string;
  anioInicio: string;
  convenio: string;
  tipoPractica: string;
  colaboradores: string;
  totalEstudiantes: number;
}

@Component({
  standalone: true,
  selector: 'app-estudiantes-en-practica',
  templateUrl: './estudiantes-en-practica.component.html',
  styleUrls: ['./estudiantes-en-practica.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatPaginatorModule
  ]
})
export class EstudiantesEnPracticaComponent implements OnInit, OnDestroy {
  private practicasService = inject(PracticasService);
  private observacionesService = inject(ObservacionesService);
  private snack = inject(MatSnackBar);
  private platformId = inject(PLATFORM_ID);
  private renderer = inject(Renderer2);
  private doc = inject(DOCUMENT);

  // Filtros
  terminoBusqueda = '';
  estadoSeleccionado: 'all' | EstadoPractica = 'all';
  anioSeleccionado: 'all' | number = 'all';
  semestreSeleccionado: 'all' | number = 'all';

  // ===== paginación =====
  pageIndex = 0;
  pageSize = 10;
  totalItems = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];

  // Datos
  practicas: PracticaEstudiante[] = [];
  cargando = false;

  // Estado para diálogo de confirmación
  mostrarDialogoNotaFinal = false;
  practicaANotar: PracticaEstudiante | null = null;

  // Estado para modal de detalles
  mostrarModalDetalles = false;
  practicaSeleccionada: PracticaEstudiante | null = null;
  observaciones: Observacion[] = [];
  notaFinalEditada: number | null = null;
  notaFinalError: string | null = null;
  guardandoNotaFinal = false;

  // Opciones de filtros
  estadosPractica: EstadoPractica[] = [
    'EN_CURSO',
    'APROBADO',
    'REPROBADO'
  ];

  anios: number[] = [];
  readonly semestres: Array<{ value: 'all' | number; label: string }> = [
    { value: 'all', label: 'Todos los semestres' },
    { value: 1, label: 'Semestre 1' },
    { value: 2, label: 'Semestre 2' },
  ];

  ngOnInit(): void {
    this.cargarPracticas();
  }

  ngOnDestroy(): void {
    this.renderer.removeClass(this.doc.body, 'student-modal-open');
  }

  private syncModalBodyClass(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const isOpen = this.mostrarModalDetalles || this.mostrarDialogoNotaFinal;
    if (isOpen) {
      this.renderer.addClass(this.doc.body, 'student-modal-open');
      return;
    }
    this.renderer.removeClass(this.doc.body, 'student-modal-open');
  }

  get canExportarPDF(): boolean {
    return !this.cargando && this.estudiantesFiltrados.length > 0;
  }

  cargarPracticas() {
    this.cargando = true;
    this.practicasService.listar().subscribe({
      next: (practicas) => {
        this.practicas = practicas.map((p: any) => this.transformarPractica(p));
        this.recalcularAniosDesdeDatos();
        this.actualizarPaginacion();
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al cargar práticas:', err);
        this.snack.open('Error al cargar estudiantes en práctica', 'Cerrar', { duration: 3000 });
        this.cargando = false;
      }
    });
  }

  transformarPractica(p: any): PracticaEstudiante {
    const formatearFecha = (fecha: any): string => {
      return fecha ? formatDateEs(fecha) : '';
    };

    const colaboradores = Array.isArray(p.practicaColaboradores)
      ? p.practicaColaboradores.map((pc: any) => ({
          id: pc.colaborador?.id || 0,
          nombre: pc.colaborador?.nombre || '',
          correo: pc.colaborador?.correo,
          tipo: pc.colaborador?.tipo,
          cargo: pc.colaborador?.cargo,
          telefono: pc.colaborador?.telefono,
        }))
      : [];

    const tutores = Array.isArray(p.practicaTutores)
      ? p.practicaTutores.map((pt: any) => ({
          tutor: {
            id: pt.tutor?.id || 0,
            rut: pt.tutor?.rut || '',
            nombre: pt.tutor?.nombre || '',
            correo: pt.tutor?.correo,
            telefono: pt.tutor?.telefono,
            cargo: pt.tutor?.cargo,
            universidad_egreso: pt.tutor?.universidad_egreso,
            direccion: pt.tutor?.direccion,
          } as Tutor,
          rol: pt.rol || 'Supervisor',
        }))
      : [];

    return {
      id: p.id,
      estado: p.estado,
      notaFinal: typeof p.nota_final === 'number' ? p.nota_final : undefined,
      fechaInicio: formatearFecha(p.fecha_inicio) || p.fecha_inicio,
      fechaTermino: p.fecha_termino ? formatearFecha(p.fecha_termino) : undefined,
      tipo: p.tipo,
      anio: typeof p.anio === 'number' ? p.anio : undefined,
      semestre: typeof p.semestre === 'number' ? p.semestre : undefined,
      estudiante: {
        rut: p.estudiante?.rut || '',
        nombre: p.estudiante?.nombre || '',
        nivel: p.estudiante?.plan || p.estudiante?.nivel || '',
        email: p.estudiante?.email
      },
      centro: {
        id: p.centro?.id || 0,
        nombre: p.centro?.nombre || '',
        direccion: p.centro?.direccion,
        tipo: p.centro?.tipo,
        region: p.centro?.region,
        comuna: p.centro?.comuna,
        convenio: p.centro?.convenio,
        fechaInicioAsociacion: p.centro?.fecha_inicio_asociacion ?? null,
      } as CentroEducativoPractica,
      colaboradores,
      tutores,
      actividades: p.actividades || []
    };
  }

  private recalcularAniosDesdeDatos() {
    const set = new Set<number>();
    this.practicas.forEach(p => {
      if (typeof p.anio === 'number') set.add(p.anio);
    });
    this.anios = Array.from(set).sort((a, b) => b - a);
  }

  formatearEstado(estado: EstadoPractica): string {
    const formato: Record<EstadoPractica, string> = {
      'EN_CURSO': 'En Curso',
      'APROBADO': 'Aprobado',
      'REPROBADO': 'Reprobado'
    };
    return formato[estado] || estado;
  }

  // Función para formatear el tipo de centro educativo
  formatearTipoCentro(tipo: string | null | undefined): string {
    if (!tipo) return 'Sin especificar';
    const formato: Record<string, string> = {
      'PARTICULAR': 'Particular',
      'PARTICULAR_SUBVENCIONADO': 'Particular Subvencionado',
      'SLEP': 'SLEP',
      'NO_CONVENCIONAL': 'No Convencional'
    };
    return formato[tipo] || tipo;
  }

  get estudiantesFiltrados(): PracticaEstudiante[] {
    const termino = this.terminoBusqueda.toLowerCase().trim();

    return this.practicas.filter(practica => {
      if (!practica || !practica.estudiante || !practica.centro) return false;

      const coincideBusqueda = !termino ||
        practica.estudiante.nombre?.toLowerCase().includes(termino) ||
        practica.estudiante.rut?.toLowerCase().includes(termino) ||
        practica.centro.nombre?.toLowerCase().includes(termino);

      const coincideEstado = this.estadoSeleccionado === 'all' ||
        practica.estado === this.estadoSeleccionado;

      const coincideAnio = this.anioSeleccionado === 'all' ||
        practica.anio === this.anioSeleccionado;

      const coincideSemestre = this.semestreSeleccionado === 'all' ||
        practica.semestre === this.semestreSeleccionado;

      return coincideBusqueda && coincideEstado && coincideAnio && coincideSemestre;
    });
  }

  // ===== items paginados de los filtrados =====
  get estudiantesPaginados(): PracticaEstudiante[] {
    const filtradas = this.estudiantesFiltrados;
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return filtradas.slice(startIndex, endIndex);
  }

  // Actualizar paginación cuando cambian los filtros o datos
  actualizarPaginacion(): void {
    this.totalItems = this.estudiantesFiltrados.length;
    // Asegurar que pageIndex no exceda el número de páginas disponibles
    const maxPage = Math.max(0, Math.ceil(this.totalItems / this.pageSize) - 1);
    if (this.pageIndex > maxPage) {
      this.pageIndex = maxPage;
    }
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.actualizarPaginacion();
  }

  onFiltersChange(): void {
    this.pageIndex = 0;
    this.actualizarPaginacion();
  }

  abrirDialogoCambioEstado(practica: PracticaEstudiante) {
    this.practicaANotar = practica;
    this.notaFinalEditada = practica.notaFinal ?? null;
    this.notaFinalError = null;
    this.mostrarDialogoNotaFinal = true;
    this.syncModalBodyClass();
  }

  cerrarDialogoCambioEstado() {
    this.mostrarDialogoNotaFinal = false;
    this.practicaANotar = null;
    this.notaFinalEditada = null;
    this.notaFinalError = null;
    this.syncModalBodyClass();
  }

  confirmarCambioEstado() {
    this.guardarNotaFinal();
  }

  private obtenerPracticaParaNota(): PracticaEstudiante | null {
    return this.practicaSeleccionada ?? this.practicaANotar;
  }

  verDetalles(practica: PracticaEstudiante) {
    this.practicaSeleccionada = practica;
    this.mostrarModalDetalles = true;
    this.syncModalBodyClass();
    this.cargarObservaciones(practica.id);
    this.notaFinalEditada = practica.notaFinal ?? null;
    this.notaFinalError = null;
  }

  cerrarDetalles() {
    this.practicaSeleccionada = null;
    this.mostrarModalDetalles = false;
    this.observaciones = [];
    this.notaFinalEditada = null;
    this.notaFinalError = null;
    this.guardandoNotaFinal = false;
    this.syncModalBodyClass();
  }

  guardarNotaFinal() {
    const practica = this.obtenerPracticaParaNota();
    if (!practica || this.notaFinalEditada === null) {
      this.notaFinalError = 'Ingresa una nota final válida.';
      this.snack.open('Ingresa una nota final valida.', 'Cerrar', { duration: 3000 });
      return;
    }

    const notaFinal = Number(this.notaFinalEditada);
    if (!Number.isFinite(notaFinal)) {
      this.notaFinalError = 'Ingresa una nota final válida.';
      this.snack.open('Ingresa una nota final valida.', 'Cerrar', { duration: 3000 });
      return;
    }
    if (notaFinal < 1 || notaFinal > 7) {
      this.notaFinalError = 'La nota final debe estar entre 1 y 7.';
      this.snack.open('La nota final debe estar entre 1 y 7.', 'Cerrar', { duration: 3000 });
      return;
    }
    this.notaFinalError = null;

    if (practica.notaFinal === notaFinal) {
      return;
    }

    this.guardandoNotaFinal = true;
    this.practicasService.actualizarNotaFinal(practica.id, notaFinal).subscribe({
      next: (response) => {
        const estadoActualizado = response.data.estado;
        practica.notaFinal = notaFinal;
        practica.estado = estadoActualizado;
        const idx = this.practicas.findIndex(p => p.id === practica.id);
        if (idx !== -1) {
          this.practicas[idx].notaFinal = notaFinal;
          this.practicas[idx].estado = estadoActualizado;
        }
        this.snack.open('Nota final actualizada exitosamente', 'Cerrar', { duration: 3000 });
        this.guardandoNotaFinal = false;
        if (this.mostrarDialogoNotaFinal) {
          this.cerrarDialogoCambioEstado();
        }
      },
      error: (err) => {
        console.error('Error al actualizar nota final:', err);
        const mensaje = err.error?.message || 'Error al actualizar la nota final';
        this.snack.open(mensaje, 'Cerrar', { duration: 4000, panelClass: ['error-snackbar'] });
        this.guardandoNotaFinal = false;
        if (this.mostrarDialogoNotaFinal) {
          this.cerrarDialogoCambioEstado();
        }
      }
    });
  }

  cargarObservaciones(practicaId: number) {
    this.observacionesService.listar(practicaId).subscribe({
      next: (obs) => {
        this.observaciones = obs;
      },
      error: (err) => {
        console.error('Error al cargar observaciones:', err);
        this.observaciones = [];
      }
    });
  }

  formatearFecha(fecha: string): string {
    return fecha ? formatDateEs(parseDateFlexible(fecha) ?? fecha) : '';
  }

  private getYearFromDate(value?: string | null): string {
    if (!value) return '—';
    const parsed = parseDateFlexible(value) ?? new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return String(parsed.getFullYear());
  }

  private buildReporteRows(practicas: PracticaEstudiante[]): ReporteCentroRow[] {
    const rows = new Map<string, {
      centro: string;
      anioInicio: string;
      convenio: string;
      tipoPractica: string;
      colaboradores: Set<string>;
      estudiantes: Set<string>;
    }>();

    for (const p of practicas) {
      if (!p?.centro?.nombre) continue;
      const tipo = (p.tipo || '').toString().trim();
      if (!tipo) continue;

      const centroId = p.centro?.id ?? 0;
      const key = `${centroId}__${tipo}`;
      if (!rows.has(key)) {
        rows.set(key, {
          centro: p.centro.nombre,
          anioInicio: this.getYearFromDate((p.centro as CentroEducativoPractica)?.fechaInicioAsociacion),
          convenio: (p.centro.convenio || '').toString().trim() || '—',
          tipoPractica: tipo,
          colaboradores: new Set<string>(),
          estudiantes: new Set<string>(),
        });
      }

      const row = rows.get(key)!;
      const nombres = (p.colaboradores || [])
        .map((c) => (c?.nombre || '').toString().trim())
        .filter((nombre) => nombre);
      nombres.forEach((nombre) => row.colaboradores.add(nombre));

      const rut = (p.estudiante?.rut || '').toString().trim();
      if (rut) row.estudiantes.add(rut);
    }

    return Array.from(rows.values())
      .map((r) => ({
        centro: r.centro,
        anioInicio: r.anioInicio,
        convenio: r.convenio || '—',
        tipoPractica: r.tipoPractica,
        colaboradores: r.colaboradores.size ? Array.from(r.colaboradores).join(', ') : 'Sin colaborador',
        totalEstudiantes: r.estudiantes.size,
      }))
      .sort((a, b) => {
        const byCentro = a.centro.localeCompare(b.centro);
        if (byCentro !== 0) return byCentro;
        return a.tipoPractica.localeCompare(b.tipoPractica);
      });
  }

  private async loadLogoAsDataURLSafe(path: string): Promise<string | null> {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await this.blobToPngDataUrl(blob, 256);
    } catch {
      return null;
    }
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
    }
  ) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 52;
    const headerH = 92;

    const headerFill: [number, number, number] = [248, 250, 252];
    const line: [number, number, number] = [229, 231, 235];
    const text: [number, number, number] = [17, 24, 39];
    const muted: [number, number, number] = [100, 116, 139];

    doc.setFillColor(...headerFill);
    doc.rect(0, 0, pageWidth, headerH, 'F');

    const drawLogo = (dataUrl: string | null | undefined, x: number, y: number, w: number, h: number) => {
      if (!dataUrl) return;
      const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(dataUrl, format, x, y, w, h);
    };

    drawLogo(opts.logoLeft, margin, 16, 76, 56);
    drawLogo(opts.logoRight, pageWidth - margin - 76, 10, 76, 76);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...text);
    doc.text(opts.title, pageWidth / 2, 36, { align: 'center' as any });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text(opts.subtitle, pageWidth / 2, 56, { align: 'center' as any });

    doc.setFontSize(9);
    doc.text(opts.generatedText, pageWidth / 2, 72, { align: 'center' as any });

    doc.setDrawColor(...line);
    doc.setLineWidth(1);
    doc.line(margin, headerH, pageWidth - margin, headerH);
  }

  private drawPdfFooter(doc: jsPDF, page: number, totalPages: number) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 52;

    const line: [number, number, number] = [229, 231, 235];
    const muted: [number, number, number] = [100, 116, 139];

    const footerY = pageHeight - 34;

    doc.setDrawColor(...line);
    doc.setLineWidth(1);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...muted);

    doc.text('Gestión Académica • Reporte de acreditación de prácticas', margin, pageHeight - 18);
    doc.text(`Página ${page} / ${totalPages}`, pageWidth - margin, pageHeight - 18, { align: 'right' as any });
  }

  exportarPDF() {
    const practicas = this.estudiantesFiltrados;
    if (!practicas.length) return;

    (async () => {
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const margin = 52;
      const headerH = 92;
      const top = headerH + 22;
      const bottom = 54;
      const contentW = pageWidth - margin * 2;

      const colors = {
        text: [17, 24, 39] as [number, number, number],
        line: [229, 231, 235] as [number, number, number],
        border: [209, 213, 219] as [number, number, number],
        tableHead: [241, 245, 249] as [number, number, number],
        zebra: [248, 250, 252] as [number, number, number],
      };

      const [logoUta, logoFeh] = await Promise.all([
        this.loadLogoAsDataURLSafe('assets/img/uta.png'),
        this.loadLogoAsDataURLSafe('assets/img/feh.png'),
      ]);

      const now = new Date();
      const generatedText = `Generado: ${formatDateEs(now)} ${now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
      const headerData = {
        title: 'REPORTE DE ACREDITACIÓN DE PRÁCTICAS',
        subtitle: 'Centros educativos con prácticas asignadas',
        generatedText,
        logoLeft: logoUta,
        logoRight: logoFeh,
      };

      this.drawPdfHeader(doc, headerData);

      const rows = this.buildReporteRows(practicas);
      if (!rows.length) {
        this.snack.open('No hay datos con tipo de practica para exportar.', 'Cerrar', { duration: 3000 });
        return;
      }
      const upper = (v: string) => v.toUpperCase();
      const tableBody = rows.map((r) => [
        upper(r.centro),
        upper(r.anioInicio),
        upper(r.convenio),
        upper(r.tipoPractica),
        upper(r.colaboradores),
        upper(String(r.totalEstudiantes)),
      ]);

      autoTable(doc, {
        startY: top,
        head: [[
          'CENTRO DE PRÁCTICA',
          'AÑO DE INICIO DEL CONVENIO',
          'TIPO DE CONVENIO',
          'TIPO DE PRÁCTICA',
          'COLABORADOR',
          'N° DE ESTUDIANTES',
        ]],
        body: tableBody,
        margin: { left: margin, right: margin, top, bottom },
        tableWidth: contentW,
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 5,
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
          fontSize: 8,
          lineColor: colors.border as any,
          lineWidth: 1,
        },
        alternateRowStyles: { fillColor: colors.zebra as any },
        columnStyles: {
          1: { halign: 'center' },
          5: { halign: 'center' },
        },
      });

      const totalPages = (doc as any).getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        this.drawPdfHeader(doc, headerData);
        this.drawPdfFooter(doc, i, totalPages);
      }

      doc.save('reporte_acreditacion_practicas.pdf');
    })();
  }
}

