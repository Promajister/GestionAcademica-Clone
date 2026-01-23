import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { jsPDF } from 'jspdf';
import {
  EstudiantesService,
  EstudianteResumen,
  EstudianteDetalle,
  EstadoPractica,
} from '../../services/estudiantes.service';
import { formatDateEs, parseDateFlexible } from '../../utils/date-utils';

@Component({
  standalone: true,
  selector: 'app-estudiantes',
  templateUrl: './estudiante.component.html',
  styleUrls: ['./estudiante.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
  ],
})
export class EstudiantesComponent implements OnInit {
  private service = inject(EstudiantesService);

  searchTerm = '';
  carreraSeleccionada: 'all' | string = 'all';
  estadoSeleccionado: 'all' | EstadoPractica = 'all';
  anioIngresoSeleccionado: number | null = null;
  carreras: string[] = [];
  tiposPractica: string[] = [
    'Apoyo a la Docencia I',
    'Apoyo a la Docencia II',
    'Apoyo a la Docencia III',
    'Apoyo a la Docencia IV',
    'Práctica Profesional',
  ];

  estudiantes: EstudianteResumen[] = [];
  seleccionado: EstudianteResumen | null = null;
  detalle: EstudianteDetalle | null = null;

  cargandoLista = false;
  cargandoDetalle = false;
  mensajeError: string | null = null;

  pageIndex = 0;
  pageSize = 10;
  totalItems = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];

  ngOnInit(): void {
    this.cargar();
  }

  private filtros() {
    const term = this.searchTerm?.trim();
    const rutTerm = term && /[0-9kK]/.test(term) ? term : undefined;
    return {
      nombre: term || undefined,
      rut: rutTerm,
      carrera: this.carreraSeleccionada !== 'all' ? this.carreraSeleccionada : undefined,
      estadoPractica: this.estadoSeleccionado !== 'all' ? this.estadoSeleccionado : undefined,
      anioIngreso: this.anioIngresoSeleccionado || undefined,
    };
  }

  cargar(): void {
    this.cargandoLista = true;
    this.mensajeError = null;
    this.service.listar(this.filtros()).subscribe({
      next: (items) => {
        this.estudiantes = (items || []).filter((e) => e.egresado !== true);
        this.actualizarPaginacion();
        this.carreras = Array.from(
          new Set(
            items
              .map((e) => (e.plan || '').trim())
              .filter((carrera) => carrera && carrera.length > 0),
          ),
        ).sort((a, b) => a.localeCompare(b, 'es'));

        if (this.seleccionado) {
          this.seleccionado = items.find((e) => e.rut === this.seleccionado!.rut) || null;
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
        this.mensajeError = 'No se pudo cargar la lista de estudiantes';
      },
    });
  }

  aplicarFiltros(): void {
    this.pageIndex = 0;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.carreraSeleccionada = 'all';
    this.estadoSeleccionado = 'all';
    this.anioIngresoSeleccionado = null;
    this.pageIndex = 0;
    this.cargar();
  }

  get estudiantesPaginados(): EstudianteResumen[] {
    const startIndex = this.pageIndex * this.pageSize;
    return this.estudiantes.slice(startIndex, startIndex + this.pageSize);
  }

  actualizarPaginacion(): void {
    this.totalItems = this.estudiantes.length;
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
    this.service.obtenerDetalle(rut).subscribe({
      next: (detalle) => {
        this.detalle = detalle;
        this.cargandoDetalle = false;
      },
      error: () => {
        this.cargandoDetalle = false;
        this.mensajeError = 'No se pudo cargar el detalle del estudiante';
      },
    });
  }

  estadoLabel(estado?: EstadoPractica | null): string {
    const map: Record<EstadoPractica, string> = {
      EN_CURSO: 'En curso',
      APROBADO: 'Aprobado',
      REPROBADO: 'Reprobado',
    };
    return estado ? map[estado] : 'Sin práctica';
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
        (index + 1) % 3 === 0 && index + 1 !== reversed.length ? `${digit}.` : digit,
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
    const parsed = parseDateFlexible(value);
    return parsed ? formatDateEs(parsed) : value;
  }

  private async cargarLogo(
    path: string,
  ): Promise<{ data: string; width: number; height: number } | null> {
    try {
      const response = await fetch(path);
      if (!response.ok) return null;
      const blob = await response.blob();
      const dataUrl = await this.blobToPngDataUrl(blob, 256);
      if (!dataUrl) return null;
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

  // Logos
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
    const format = logo.data.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    doc.addImage(logo.data, format, x, yy, w, h);
  };

  // Header reutilizable
  const headerH = 92;

  const now = new Date();
  const fecha = formatDateEs(now);
  const hora = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const emitidoText = `Emitido: ${fecha}  ${hora}`;

  const drawHeader = () => {
    doc.setFillColor(colors.headerFill);
    doc.rect(0, 0, pageWidth, headerH, 'F');

    drawLogo(logoUta, margin, 16, 76, 56);
    drawLogo(logoFeh, pageWidth - margin - 76, 8, 76, 76);

    setFont(14, 'bold', colors.text);
    doc.text('FICHA DE ESTUDIANTE', pageWidth / 2, 36, { align: 'center' as any });

    setFont(10, 'normal', colors.muted);
    doc.text('Registro académico', pageWidth / 2, 56, { align: 'center' as any });

    setFont(9, 'normal', colors.muted);
    doc.text(emitidoText, pageWidth / 2, 72, { align: 'center' as any });

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

  // Primera página
  drawHeader();
  y = contentStartY();

  // Identificación
  const practicasCount = detalle.practicas?.length || 0;

  setFont(13, 'bold', colors.text);
  doc.text(safe(detalle.nombre), pageWidth / 2, y, { align: 'center' as any });
  y += 16;

  setFont(10, 'normal', colors.muted);
  doc.text(
    `${this.formatearRut(detalle.rut)}  •  ${safe(detalle.plan)}  •  Prácticas: ${practicasCount}`,
    pageWidth / 2,
    y,
    { align: 'center' as any },
  );
  y += 14;

  drawLine(y);
  y += 18;

  // Secciones apiladas
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
    ['Género', safe(detalle.genero)],
    ['Año nacimiento', this.formatearFecha(detalle.anio_nacimiento)],
    ['Dirección', safe((detalle as any).direccion)],
  ]);

  section('Datos académicos', [
    ['Carrera / Plan', safe(detalle.plan)],
    ['Año de ingreso', safe((detalle as any).anio_ingreso)],
    ['Sistema de ingreso', safe((detalle as any).sistema_ingreso)],
    ['N° inscripciones', safe((detalle as any).numero_inscripciones)],
    ['Avance', this.formatearNumero((detalle as any).avance)],
    ['Puntaje ponderado', this.formatearNumero((detalle as any).puntaje_ponderado)],
    ['Puntaje PSU', this.formatearNumero((detalle as any).puntaje_psu)],
    ['Promedio de prácticas', this.formatearNumero((detalle as any).promedio)],
  ]);

  section('Contacto', [
    ['Correo', safe((detalle as any).email)],
    ['Teléfono', safe((detalle as any).fono)],
  ]);

  // Forzar prácticas a nueva página
  addPageWithHeader();

  // Historial de prácticas
  ensure(80);
  setFont(11, 'bold', colors.text);
  doc.text('HISTORIAL DE PRÁCTICAS', margin, y);
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
      // detectar wraps por celda
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
        // alineación centro solo para N°
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
    doc.text('Sin prácticas registradas.', margin, y);
    y += 18;
  } else {
    const cols = [
      { label: 'N°', w: 34 },
      { label: 'Tipo', w: 170 },
      { label: 'Estado', w: 82 },
      { label: 'Fechas', w: 150 },
      { label: 'Centro', w: contentW - (34 + 170 + 82 + 150) },
    ];

    const rows = detalle.practicas.map((p: any, idx: number) => {
      const tipo = safe(p?.tipo);
      const estado = this.estadoLabel(p?.estado);
      const fechas = `${this.formatearFecha(p?.fecha_inicio)} - ${this.formatearFecha(p?.fecha_termino)}`;
      const centro = safe(p?.centro?.nombre);
      return [String(idx + 1), tipo, estado, fechas, centro];
    });

    drawTable(cols, rows);
  }

  // Actividades asociadas (después de prácticas)
  drawSimpleTitle('ACTIVIDADES ASOCIADAS');

  const actividades = ((detalle as any).actividades || []) as any[];

  if (!actividades.length) {
    setFont(10, 'normal', colors.muted);
    doc.text('Sin actividades asociadas.', margin, y);
    y += 16;
  } else {
    // Columnas (ajustadas a tu modelo Actividad)
    const colsAct = [
      { label: 'N°', w: 34 },
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

    // Opcional: si quieres incluir “Terceros asistieron” y “Evidencia”
    // puedes agregar otra tabla o ampliar columnas.
  }

  // Footer con total páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(colors.line);
    doc.setLineWidth(1);
    doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);

    setFont(9, 'normal', colors.muted);
    doc.text('Gestión Académica • Ficha de estudiante', margin, pageHeight - 18);
    doc.text(`Página ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 18, {
      align: 'right' as any,
    });
  }

  doc.save(`estudiante_${detalle.rut}.pdf`);
}


}



