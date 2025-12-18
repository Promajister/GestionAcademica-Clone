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
  pageSize = 5;
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
        this.estudiantes = items;
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
    const marginX = 46;
    let y = 32;

    const [logoUta, logoFeh] = await Promise.all([
      this.cargarLogo('assets/img/uta.png'),
      this.cargarLogo('assets/img/feh.png'),
    ]);

    // Header con logos (UTA a la izquierda, Depto. a la derecha)
    const logoUtaBox = { width: 76, height: 56 };
    const logoFehBox = { width: 76, height: 76 };
    const logosHeight = Math.max(logoUtaBox.height, logoFehBox.height);
    const drawLogo = (
      logo: { data: string; width: number; height: number } | null,
      boxX: number,
      boxY: number,
      boxWidth: number,
      boxHeight: number,
    ) => {
      if (!logo) return;
      const scale = Math.min(boxWidth / logo.width, boxHeight / logo.height);
      const width = logo.width * scale;
      const height = logo.height * scale;
      const x = boxX + (boxWidth - width) / 2;
      const yPos = boxY + (boxHeight - height) / 2;
      doc.addImage(logo.data, 'PNG', x, yPos, width, height);
    };
    drawLogo(logoUta, marginX, y, logoUtaBox.width, logoUtaBox.height);
    drawLogo(
      logoFeh,
      pageWidth - marginX - logoFehBox.width,
      y,
      logoFehBox.width,
      logoFehBox.height,
    );

    // Información del documento debajo del header (centrada)
    const rightBoxWidth = 165;
    const rightBoxX = pageWidth - marginX - rightBoxWidth;
    const rightBoxY = y + logosHeight + 8;
    const rightBoxHeight = 80;
    
    // Dibujar cuadro con mejor estilo
    doc.setDrawColor('#cbd5e1');
    doc.setFillColor('#ffffff');
    doc.setLineWidth(1.5);
    doc.roundedRect(rightBoxX, rightBoxY, rightBoxWidth, rightBoxHeight, 5, 5, 'FD');
    
    // Contenido del cuadro
    const now = new Date();
    const fecha = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    doc.setFontSize(8);
    doc.setTextColor('#6b7280');
    doc.setFont('helvetica', 'normal');

    const labelX = rightBoxX + 12;
    const labelWidth = 70;
    const valueX = labelX + labelWidth;
    const lineHeight = 14;
    let lineY = rightBoxY + 22;

    const drawRow = (label: string, value: string) => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#6b7280');
      doc.text(label, labelX, lineY);
      doc.setTextColor('#111827');
      doc.text(value, valueX, lineY);
      lineY += lineHeight;
    };

    drawRow('Fecha:', fecha);
    drawRow('Hora:', hora);
    drawRow('Paginas:', '1/1');
    drawRow('Cant. Practicas:', String(detalle.practicas?.length || 0));
    // Título centrado
    const headerBlockHeight = logosHeight + 8 + rightBoxHeight;
    y = y + headerBlockHeight + 18;
    
    doc.setFontSize(13);
    doc.setTextColor('#111827');
    doc.setFont('helvetica', 'bold');
    const title = 'FICHA DE ESTUDIANTE - REGISTRO ACADÉMICO Y PRÁCTICAS';
    const titleWidth = doc.getTextWidth(title);
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, y);
    
    y += 24;

    // Información del estudiante en una tarjeta
    const infoRows: [string, string][] = [
      ['Nombre', detalle.nombre],
      ['RUT', this.formatearRut(detalle.rut)],
      ['Carrera / Plan', detalle.plan || '-'],
      ['Género', detalle.genero || '-'],
      ['Año nacimiento', this.formatearFecha(detalle.anio_nacimiento)],
      ['Correo', detalle.email || '-'],
      ['Teléfono', String(detalle.fono ?? '-')],
      ['Dirección', detalle.direccion || '-'],
      ['Año de ingreso', String(detalle.anio_ingreso ?? '-')],
      ['Sistema de ingreso', detalle.sistema_ingreso || '-'],
      ['N° inscripciones', String(detalle.numero_inscripciones ?? '-')],
      ['Avance', this.formatearNumero(detalle.avance)],
      ['Puntaje ponderado', this.formatearNumero(detalle.puntaje_ponderado)],
      ['Puntaje PSU', this.formatearNumero(detalle.puntaje_psu)],
      ['Promedio', this.formatearNumero(detalle.promedio)],
    ];

    const drawCard = (rows: [string, string][]) => {
      const labelWidth = 140;
      const valueWidth = pageWidth - marginX * 2 - labelWidth - 16;
      const rowHeights = rows.map(([, value]) => {
        const split = doc.splitTextToSize(String(value ?? '-'), valueWidth);
        return Math.max(18, split.length * 12);
      });
      const cardHeight = rowHeights.reduce((total, height) => total + height, 0) + 14;

      doc.setDrawColor('#d1d5db');
      doc.setFillColor('#ffffff');
      doc.setLineWidth(1.5);
      doc.roundedRect(
        marginX - 6,
        y - 10,
        pageWidth - marginX * 2 + 12,
        cardHeight,
        6,
        6,
        'FD',
      );
      let ly = y + 8;
      const valueX = marginX + 8 + labelWidth;
      doc.setFontSize(10);
      rows.forEach(([label, value], index) => {
        const safeValue = String(value ?? '-');
        doc.setTextColor('#6b7280');
        doc.setFont('helvetica', 'normal');
        doc.text(`${label}:`, marginX + 8, ly);
        doc.setTextColor('#111827');
        doc.setFont('helvetica', 'normal');
        const split = doc.splitTextToSize(safeValue, valueWidth);
        doc.text(split, valueX, ly);
        ly += rowHeights[index];
      });
      y = ly + 6;
    };

    drawCard(infoRows);

    const sectionTitle = (title: string) => {
      y += 14; // Espacio antes del título
      doc.setTextColor('#1f2937');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(title, marginX, y);
      // Línea decorativa debajo del título de sección
      doc.setDrawColor('#e5e7eb');
      doc.setLineWidth(0.5);
      doc.line(marginX, y + 5, marginX + 250, y + 5);
      y += 18; // Espacio después del título
    };

    const bodyText = (text: string) => {
      doc.setFontSize(11);
      doc.setTextColor('#6b7280');
      doc.setFont('helvetica', 'normal');
      const split = doc.splitTextToSize(text, pageWidth - marginX * 2);
      doc.text(split, marginX, y);
      y += split.length * 14;
    };

    // Historial de prácticas
    sectionTitle('Historial de prácticas');
    if (detalle.practicas?.length) {
      detalle.practicas.forEach((p, idx) => {
        if (y > doc.internal.pageSize.getHeight() - 100) {
          doc.addPage();
          y = 52;
        }
        
        // Tipo de práctica en línea separada (si existe)
        if (p.tipo) {
          doc.setFontSize(11);
          doc.setTextColor('#0f172a');
          doc.setFont('helvetica', 'bold');
          doc.text(`${idx + 1}. ${p.tipo}`, marginX, y);
          y += 18;
          
          // Estado y fechas en línea siguiente
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor('#4b5563');
          doc.text(
            `${this.estadoLabel(p.estado)} • ${this.formatearFecha(p.fecha_inicio)} - ${this.formatearFecha(p.fecha_termino)}`,
            marginX + 18,
            y,
          );
          y += 16;
        } else {
          // Si no hay tipo, mostrar número con estado y fechas
          doc.setFontSize(11);
          doc.setTextColor('#0f172a');
          doc.setFont('helvetica', 'normal');
          doc.text(
            `${idx + 1}. ${this.estadoLabel(p.estado)} • ${this.formatearFecha(p.fecha_inicio)} - ${this.formatearFecha(p.fecha_termino)}`,
            marginX,
            y,
          );
          y += 16;
        }
        
        // Centro educativo (si existe)
        if (p.centro?.nombre) {
          doc.setFontSize(9);
          doc.setTextColor('#6b7280');
          doc.text(`Centro: ${p.centro.nombre}`, marginX + 18, y);
          y += 14;
        }
        y += 6;
      });
    } else {
      bodyText('Sin prácticas registradas.');
      y += 8;
    }

    doc.save(`estudiante_${detalle.rut}.pdf`);
  }
}



