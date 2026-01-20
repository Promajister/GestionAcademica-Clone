import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  Renderer2,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { jsPDF } from 'jspdf';
import {
  EstudiantesService,
  EstudianteDetalle,
  EstudianteResumen,
} from '../../services/estudiantes.service';

@Component({
  standalone: true,
  selector: 'app-egresados-registro',
  templateUrl: './egresados-registro.component.html',
  styleUrls: ['./egresados-registro.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
})
export class EgresadosRegistroComponent implements OnInit, OnDestroy {
  private estudiantesService = inject(EstudiantesService);
  private renderer = inject(Renderer2);
  private doc = inject(DOCUMENT);
  private snack = inject(MatSnackBar);

  egresados: EstudianteResumen[] = [];
  seleccionado: EstudianteResumen | null = null;
  detalle: EstudianteDetalle | null = null;

  searchTerm = '';
  cargandoLista = false;
  cargandoDetalle = false;
  mensajeError: string | null = null;

  pageIndex = 0;
  pageSize = 8;
  totalItems = 0;
  readonly pageSizeOptions = [5, 8, 12, 20];

  modalOpen = false;
  isSaving = false;
  cargandoModal = false;
  filtroModal = '';
  estudiantesModal: EstudianteResumen[] = [];
  seleccionados = new Set<string>();

  empleabilidadModalOpen = false;
  empleabilidadSaving = false;
  empleabilidadForm = {
    egresadoRut: '',
    lugarTrabajo: '',
    sector: '',
    sectorOtro: '',
    cargo: '',
    cargoOtro: '',
  };

  readonly sectorOptions = [
    { value: 'publico', label: 'Publico' },
    { value: 'privado', label: 'Privado' },
    { value: 'otro', label: 'Otro' },
  ];

  readonly cargoOptions = [
    { value: 'jefatura', label: 'Jefatura' },
    { value: 'dependiente', label: 'Dependiente' },
    { value: 'independiente', label: 'Independiente' },
    { value: 'otro', label: 'Otro' },
  ];

  ngOnInit(): void {
    this.cargarEgresados();
  }

  ngOnDestroy(): void {
    this.renderer.removeClass(this.doc.body, 'student-modal-open');
  }

  private syncModalBodyClass(): void {
    if (this.modalOpen || this.empleabilidadModalOpen) {
      this.renderer.addClass(this.doc.body, 'student-modal-open');
      return;
    }
    this.renderer.removeClass(this.doc.body, 'student-modal-open');
  }

  cargarEgresados(): void {
    this.cargandoLista = true;
    this.mensajeError = null;
    this.estudiantesService.listar({ egresado: true }).subscribe({
      next: (items) => {
        this.egresados = items || [];
        this.actualizarPaginacion();
        if (this.seleccionado) {
          this.seleccionado =
            items.find((e) => e.rut === this.seleccionado!.rut) || null;
        }
        if (this.seleccionado) {
          this.obtenerDetalle(this.seleccionado.rut, false);
        } else {
          this.detalle = null;
        }
        this.cargandoLista = false;
      },
      error: () => {
        this.cargandoLista = false;
        this.mensajeError = 'No se pudo cargar la lista de egresados.';
      },
    });
  }

  aplicarFiltros(): void {
    this.pageIndex = 0;
    this.actualizarPaginacion();
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.pageIndex = 0;
    this.actualizarPaginacion();
  }

  get egresadosFiltrados(): EstudianteResumen[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.egresados;
    return this.egresados.filter((e) => {
      const nombre = (e.nombre || '').toLowerCase();
      const rut = (e.rut || '').toLowerCase();
      const plan = (e.plan || '').toLowerCase();
      return (
        nombre.includes(term) || rut.includes(term) || plan.includes(term)
      );
    });
  }

  get egresadosPaginados(): EstudianteResumen[] {
    const startIndex = this.pageIndex * this.pageSize;
    return this.egresadosFiltrados.slice(
      startIndex,
      startIndex + this.pageSize,
    );
  }

  actualizarPaginacion(): void {
    this.totalItems = this.egresadosFiltrados.length;
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

  seleccionar(estudiante: EstudianteResumen): void {
    this.seleccionado = estudiante;
    this.obtenerDetalle(estudiante.rut, true);
  }

  obtenerDetalle(rut: string, resetDetalle = true): void {
    this.cargandoDetalle = true;
    if (resetDetalle) {
      this.detalle = null;
    }
    this.estudiantesService.obtenerDetalle(rut).subscribe({
      next: (detalle) => {
        this.detalle = detalle;
        this.cargandoDetalle = false;
      },
      error: () => {
        this.cargandoDetalle = false;
        this.mensajeError = 'No se pudo cargar el detalle del egresado.';
      },
    });
  }

  abrirModal(): void {
    this.modalOpen = true;
    this.syncModalBodyClass();
    this.cargarModal();
  }

  cerrarModal(): void {
    this.modalOpen = false;
    this.filtroModal = '';
    this.seleccionados.clear();
    this.syncModalBodyClass();
  }

  abrirEmpleabilidadModal(): void {
    if (!this.seleccionado) return;
    this.empleabilidadForm = {
      egresadoRut: this.seleccionado.rut,
      lugarTrabajo: '',
      sector: '',
      sectorOtro: '',
      cargo: '',
      cargoOtro: '',
    };
    this.empleabilidadModalOpen = true;
    this.syncModalBodyClass();
  }

  cerrarEmpleabilidadModal(): void {
    this.empleabilidadModalOpen = false;
    this.syncModalBodyClass();
  }

  empleabilidadValida(): boolean {
    if (!this.empleabilidadForm.egresadoRut) return false;
    if (!this.empleabilidadForm.lugarTrabajo.trim()) return false;
    if (!this.empleabilidadForm.sector) return false;
    if (this.empleabilidadForm.sector === 'otro' && !this.empleabilidadForm.sectorOtro.trim()) {
      return false;
    }
    if (!this.empleabilidadForm.cargo) return false;
    if (this.empleabilidadForm.cargo === 'otro' && !this.empleabilidadForm.cargoOtro.trim()) {
      return false;
    }
    return true;
  }

  guardarEmpleabilidad(): void {
    if (!this.empleabilidadValida()) return;
    const rut = this.empleabilidadForm.egresadoRut;
    const payload = {
      lugarTrabajo: this.empleabilidadForm.lugarTrabajo.trim(),
      sector: this.empleabilidadForm.sector,
      sectorOtro: this.empleabilidadForm.sector === 'otro'
        ? this.empleabilidadForm.sectorOtro.trim()
        : null,
      cargo: this.empleabilidadForm.cargo,
      cargoOtro: this.empleabilidadForm.cargo === 'otro'
        ? this.empleabilidadForm.cargoOtro.trim()
        : null,
    };

    this.empleabilidadSaving = true;
    this.estudiantesService.guardarEmpleabilidad(rut, payload).subscribe({
      next: () => {
        this.empleabilidadSaving = false;
        this.snack.open('Empleabilidad guardada.', 'OK', { duration: 3000 });
        this.cerrarEmpleabilidadModal();
      },
      error: () => {
        this.empleabilidadSaving = false;
        this.snack.open('No se pudo guardar la empleabilidad.', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  cargarModal(): void {
    this.cargandoModal = true;
    this.estudiantesService.listar().subscribe({
      next: (items) => {
        this.estudiantesModal = items || [];
        this.cargandoModal = false;
      },
      error: () => {
        this.cargandoModal = false;
      },
    });
  }

  get estudiantesModalFiltrados(): EstudianteResumen[] {
    const term = this.filtroModal.trim().toLowerCase();
    if (!term) return this.estudiantesModal;
    return this.estudiantesModal.filter((e) => {
      const nombre = (e.nombre || '').toLowerCase();
      const rut = (e.rut || '').toLowerCase();
      const plan = (e.plan || '').toLowerCase();
      return (
        nombre.includes(term) || rut.includes(term) || plan.includes(term)
      );
    });
  }

  toggleSeleccion(estudiante: EstudianteResumen): void {
    if (estudiante.egresado) return;
    if (this.seleccionados.has(estudiante.rut)) {
      this.seleccionados.delete(estudiante.rut);
      return;
    }
    this.seleccionados.add(estudiante.rut);
  }

  marcarComoEgresados(): void {
    if (this.seleccionados.size === 0) return;
    this.isSaving = true;
    const ops = Array.from(this.seleccionados).map((rut) =>
      this.estudiantesService.actualizarEgresado(rut, true),
    );

    forkJoin(ops).subscribe({
      next: () => {
        this.isSaving = false;
        this.cerrarModal();
        this.cargarEgresados();
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  formatearRut(rut?: string | null): string {
    if (!rut) return '-';
    const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length <= 1) return clean;
    const cuerpo = clean.slice(0, -1);
    const dv = clean.slice(-1);
    const reversed = cuerpo.split('').reverse();
    const withDots = reversed
      .map((digit, index) =>
        (index + 1) % 3 === 0 && index + 1 !== reversed.length
          ? `${digit}.`
          : digit,
      )
      .join('');
    return `${withDots.split('').reverse().join('')}-${dv}`;
  }

  formatearNumero(value?: number | null): string {
    if (value === null || value === undefined) return '-';
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(2);
  }

  formatearFecha(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date.toLocaleDateString('es-CL');
  }

  private async cargarLogo(
    path: string,
  ): Promise<{ data: string; width: number; height: number } | null> {
    try {
      const response = await fetch(path);
      if (!response.ok) return null;
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo cargar el logo'));
        img.src = dataUrl;
      });
      return { data: dataUrl, width: image.width, height: image.height };
    } catch {
      return null;
    }
  }

  async exportarPdf(): Promise<void> {
    if (!this.detalle) return;
    const detalle = this.detalle;

    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 52;
    const bottom = 54;
    const contentW = pageWidth - margin * 2;

    const colors = {
      text: '#111827',
      muted: '#6b7280',
      line: '#e5e7eb',
      border: '#d1d5db',
      headerFill: '#f8fafc',
      tableHead: '#f1f5f9',
    };

    const safe = (v: any) => (v === null || v === undefined || v === '' ? '-' : String(v));

    const setFont = (size: number, style: 'normal' | 'bold' = 'normal', color = colors.text) => {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(color);
    };

    const drawLine = (yy: number) => {
      doc.setDrawColor(colors.line);
      doc.setLineWidth(1);
      doc.line(margin, yy, pageWidth - margin, yy);
    };

    const [logoUta, logoFeh] = await Promise.all([
      this.cargarLogo('assets/img/uta.png'),
      this.cargarLogo('assets/img/feh.png'),
    ]);

    const drawLogo = (
      logo: { data: string; width: number; height: number } | null,
      boxX: number,
      boxY: number,
      boxW: number,
      boxH: number,
    ) => {
      if (!logo) return;
      const scale = Math.min(boxW / logo.width, boxH / logo.height);
      const w = logo.width * scale;
      const h = logo.height * scale;
      const x = boxX + (boxW - w) / 2;
      const yy = boxY + (boxH - h) / 2;
      doc.addImage(logo.data, 'PNG', x, yy, w, h);
    };

    const headerH = 92;

    const drawHeader = () => {
      doc.setFillColor(colors.headerFill);
      doc.rect(0, 0, pageWidth, headerH, 'F');

      drawLogo(logoUta, margin, 16, 76, 56);
      drawLogo(logoFeh, pageWidth - margin - 76, 8, 76, 76);

      setFont(14, 'bold', colors.text);
      doc.text('FICHA DE ESTUDIANTE EGRESADO', pageWidth / 2, 36, { align: 'center' as any });

      setFont(10, 'normal', colors.muted);
      doc.text('Registro academico', pageWidth / 2, 56, { align: 'center' as any });

      doc.setDrawColor(colors.line);
      doc.line(margin, headerH, pageWidth - margin, headerH);
    };

    const contentStartY = () => headerH + 22;

    let y = contentStartY();

    const addPageWithHeader = () => {
      doc.addPage();
      drawHeader();
      y = contentStartY();
    };

    const ensure = (needed: number) => {
      if (y + needed <= pageHeight - bottom) return;
      addPageWithHeader();
    };

    drawHeader();
    y = contentStartY();

    const now = new Date();
    const fecha = now.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const practicasCount = detalle.practicas?.length || 0;

    setFont(13, 'bold', colors.text);
    doc.text(safe(detalle.nombre), pageWidth / 2, y, { align: 'center' as any });
    y += 16;

    setFont(10, 'normal', colors.muted);
    doc.text(
      `${this.formatearRut(detalle.rut)}  •  ${safe(detalle.plan)}  •  Practicas: ${practicasCount}`,
      pageWidth / 2,
      y,
      { align: 'center' as any },
    );
    y += 14;

    setFont(9, 'normal', colors.muted);
    doc.text(`Emitido: ${fecha}  ${hora}`, pageWidth / 2, y, { align: 'center' as any });
    y += 18;

    drawLine(y);
    y += 18;

    const section = (title: string, rows: [string, string][]) => {
      y += 18;
      ensure(70);

      setFont(11, 'bold', colors.text);
      doc.text(title.toUpperCase(), margin, y);

      y += 8;
      doc.setDrawColor(colors.line);
      doc.setLineWidth(1);
      doc.line(margin, y, margin + 260, y);

      y += 14;

      const labelW = 170;
      const valueW = contentW - labelW;

      rows.forEach(([label, value]) => {
        const v = safe(value);

        setFont(9, 'normal', colors.text);
        const lines = doc.splitTextToSize(v, valueW - 14);
        const rowH = Math.max(22, lines.length * 12 + 10);

        ensure(rowH + 12);

        doc.setDrawColor(colors.border);
        doc.setLineWidth(1);
        doc.rect(margin, y, contentW, rowH);

        doc.setDrawColor(colors.line);
        doc.line(margin + labelW, y, margin + labelW, y + rowH);

        setFont(9, 'bold', colors.muted);
        doc.text(`${label}:`, margin + 10, y + 15);

        setFont(9, 'normal', colors.text);
        doc.text(lines, margin + labelW + 10, y + 15);

        y += rowH;
      });

      y += 16;
    };

    section('Datos personales', [
      ['RUT', this.formatearRut(detalle.rut)],
      ['Genero', safe(detalle.genero)],
      ['Ano nacimiento', this.formatearFecha(detalle.anio_nacimiento)],
      ['Direccion', safe((detalle as any).direccion)],
    ]);

    section('Datos academicos', [
      ['Carrera / Plan', safe(detalle.plan)],
      ['Ano de ingreso', safe((detalle as any).anio_ingreso)],
      ['Sistema de ingreso', safe((detalle as any).sistema_ingreso)],
      ['Nro inscripciones', safe((detalle as any).numero_inscripciones)],
      ['Avance', this.formatearNumero((detalle as any).avance)],
      ['Puntaje ponderado', this.formatearNumero((detalle as any).puntaje_ponderado)],
      ['Puntaje PSU', this.formatearNumero((detalle as any).puntaje_psu)],
      ['Promedio de practicas', this.formatearNumero((detalle as any).promedio)],
    ]);

    section('Contacto', [
      ['Correo', safe((detalle as any).email)],
      ['Telefono', safe((detalle as any).fono)],
    ]);

    addPageWithHeader();

    ensure(80);
    setFont(11, 'bold', colors.text);
    doc.text('HISTORIAL DE PRACTICAS', margin, y);
    y += 8;

    doc.setDrawColor(colors.line);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + 260, y);

    y += 14;

    const drawSimpleTitle = (title: string) => {
      y += 18;
      ensure(70);
      setFont(11, 'bold', colors.text);
      doc.text(title, margin, y);
      y += 8;
      doc.setDrawColor(colors.line);
      doc.setLineWidth(1);
      doc.line(margin, y, margin + 260, y);
      y += 14;
    };

    const drawTable = (
      cols: { label: string; w: number }[],
      rows: (string | string[])[][],
    ) => {
      const headH = 22;

      const drawTableHead = () => {
        ensure(headH + 10);
        doc.setDrawColor(colors.border);
        doc.setFillColor(colors.tableHead);
        doc.rect(margin, y, contentW, headH, 'FD');
        setFont(9, 'bold', colors.text);
        let x = margin;
        cols.forEach((c, idx) => {
          doc.text(c.label, x + 8, y + 15);
          x += c.w;
          doc.setDrawColor(colors.line);
          if (idx < cols.length - 1) {
            doc.line(x, y, x, y + headH);
          }
        });
        y += headH;
      };

      drawTableHead();

      const rowHBase = 22;

      rows.forEach((r) => {
        const wrapped: string[][] = r.map((cell, i) => {
          const txt = safe(cell as any);
          const maxW = cols[i].w - 14;
          setFont(9, 'normal', colors.text);
          return doc.splitTextToSize(txt, maxW) as string[];
        });

        const maxLines = Math.max(...wrapped.map((w) => w.length));
        const rowH = Math.max(rowHBase, maxLines * 12 + 10);

        if (y + rowH > pageHeight - bottom) {
          addPageWithHeader();
          drawTableHead();
        }

        doc.setDrawColor(colors.border);
        doc.setLineWidth(1);
        doc.rect(margin, y, contentW, rowH);

        let x = margin;
        cols.forEach((c, i) => {
          x += c.w;
          doc.setDrawColor(colors.line);
          if (i < cols.length - 1) {
            doc.line(x, y, x, y + rowH);
          }
        });

        let cx = margin;
        wrapped.forEach((lines, i) => {
          if (i === 0) {
            doc.text(lines[0] ?? '-', cx + cols[i].w / 2, y + 15, { align: 'center' as any });
          } else {
            doc.text(lines, cx + 8, y + 15);
          }
          cx += cols[i].w;
        });

        y += rowH;
      });

      y += 14;
    };

    if (!detalle.practicas?.length) {
      setFont(10, 'normal', colors.muted);
      doc.text('Sin practicas registradas.', margin, y);
      y += 18;
    } else {
      const cols = [
        { label: 'Nro', w: 34 },
        { label: 'Tipo', w: 170 },
        { label: 'Estado', w: 82 },
        { label: 'Fechas', w: 150 },
        { label: 'Centro', w: contentW - (34 + 170 + 82 + 150) },
      ];

      const rows = detalle.practicas.map((p: any, idx: number) => {
        const tipo = safe(p?.tipo);
        const estado = safe(p?.estado);
        const fechas = `${this.formatearFecha(p?.fecha_inicio)} - ${this.formatearFecha(p?.fecha_termino)}`;
        const centro = safe(p?.centro?.nombre);
        return [String(idx + 1), tipo, estado, fechas, centro];
      });

      drawTable(cols, rows);
    }

    drawSimpleTitle('ACTIVIDADES ASOCIADAS');

    const actividades = ((detalle as any).actividades || []) as any[];

    if (!actividades.length) {
      setFont(10, 'normal', colors.muted);
      doc.text('Sin actividades asociadas.', margin, y);
      y += 16;
    } else {
      const colsAct = [
        { label: 'Nro', w: 34 },
        { label: 'Actividad', w: 220 },
        { label: 'Fecha', w: 110 },
        { label: 'Horario', w: 85 },
        { label: 'Lugar', w: contentW - (34 + 220 + 110 + 85) },
      ];

      const rowsAct = actividades.map((a: any, idx: number) => {
        const nombre = safe(a?.nombre_actividad ?? a?.titulo ?? a?.nombre);
        const fechaAct = this.formatearFecha(a?.fecha ?? a?.fechaRegistro);
        const horario = safe(a?.horario);
        const lugar = safe(a?.lugar ?? a?.descripcion);
        return [String(idx + 1), nombre, fechaAct, horario, lugar];
      });

      drawTable(colsAct, rowsAct);
    }

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(colors.line);
      doc.setLineWidth(1);
      doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);
      setFont(9, 'normal', colors.muted);
      doc.text('Gestion Academica • Ficha de estudiante egresado', margin, pageHeight - 18);
      doc.text(`Pagina ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 18, {
        align: 'right' as any,
      });
    }

    doc.save(`egresado_${detalle.rut}.pdf`);
  }
}
