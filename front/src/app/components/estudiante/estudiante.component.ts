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
import { jsPDF } from 'jspdf';
import { LOGO_UTA_BASE64, LOGO_FEH_BASE64 } from '../carta/logos.base64';
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
  ],
})
export class EstudiantesComponent implements OnInit {
  private service = inject(EstudiantesService);

  searchTerm = '';
  carreraSeleccionada: 'all' | string = 'all';
  estadoSeleccionado: 'all' | EstadoPractica = 'all';
  tipoPracticaSeleccionada: string = '';
  semestreSeleccionado: 'all' | 1 | 2 = 'all';
  anioSeleccionado: number | null = null;
  carreras: string[] = [];
  tiposPractica: string[] = [
    'Apoyo a la Docencia I',
    'Apoyo a la Docencia II',
    'Apoyo a la Docencia III',
    'Práctica Profesional',
  ];

  estudiantes: EstudianteResumen[] = [];
  seleccionado: EstudianteResumen | null = null;
  detalle: EstudianteDetalle | null = null;

  cargandoLista = false;
  cargandoDetalle = false;
  mensajeError: string | null = null;

  ngOnInit(): void {
    this.cargar();
  }

  private filtros() {
    return {
      nombre: this.searchTerm || undefined,
      carrera: this.carreraSeleccionada !== 'all' ? this.carreraSeleccionada : undefined,
      estadoPractica: this.estadoSeleccionado !== 'all' ? this.estadoSeleccionado : undefined,
      tipoPractica: this.tipoPracticaSeleccionada || undefined,
      semestre: this.semestreSeleccionado === 'all' ? undefined : this.semestreSeleccionado,
      anio: this.anioSeleccionado || undefined,
    };
  }

  cargar(): void {
    this.cargandoLista = true;
    this.mensajeError = null;
    this.service.listar(this.filtros()).subscribe({
      next: (items) => {
        this.estudiantes = items;
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
    this.cargar();
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

  formatearFecha(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date.toLocaleDateString('es-CL');
  }

  exportarPdf(): void {
    if (!this.detalle) return;

    const detalle = this.detalle;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const marginX = 46;
    let y = 32;

    // Header con logo UTA (manteniendo relación de aspecto)
    const logoWidth = 80;
    const logoHeight = 60; // Relación de aspecto aproximada 4:3
    doc.addImage(LOGO_UTA_BASE64, 'PNG', marginX, y, logoWidth, logoHeight);

    // Información del documento a la derecha (en un cuadro)
    const rightBoxX = doc.internal.pageSize.getWidth() - marginX - 165;
    const rightBoxY = y;
    const rightBoxWidth = 165;
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
    
    const rightTextX = rightBoxX + 10;
    let rightTextY = rightBoxY + 16;
    
    doc.setFontSize(8);
    doc.text('Fecha:', rightTextX, rightTextY);
    doc.setTextColor('#111827');
    doc.setFont('helvetica', 'normal');
    doc.text(`: ${fecha}`, rightTextX + 38, rightTextY);
    
    rightTextY += 13;
    doc.setTextColor('#6b7280');
    doc.text('Hora:', rightTextX, rightTextY);
    doc.setTextColor('#111827');
    doc.text(`: ${hora}`, rightTextX + 38, rightTextY);
    
    rightTextY += 13;
    doc.setTextColor('#6b7280');
    doc.text('Páginas:', rightTextX, rightTextY);
    doc.setTextColor('#111827');
    doc.text(': 1/1', rightTextX + 48, rightTextY);
    
    rightTextY += 13;
    doc.setTextColor('#6b7280');
    doc.text('Cant. Prácticas:', rightTextX, rightTextY);
    doc.setTextColor('#111827');
    doc.text(`: ${detalle.practicas?.length || 0}`, rightTextX + 78, rightTextY);

    // Título centrado
    const headerBlockHeight = Math.max(logoHeight, rightBoxHeight);
    y = y + headerBlockHeight + 20;
    
    doc.setFontSize(13);
    doc.setTextColor('#111827');
    doc.setFont('helvetica', 'bold');
    const title = 'FICHA DE ESTUDIANTE - REGISTRO ACADÉMICO Y PRÁCTICAS';
    const titleWidth = doc.getTextWidth(title);
    const titleX = (doc.internal.pageSize.getWidth() - titleWidth) / 2;
    doc.text(title, titleX, y);
    
    y += 24;

    // Información del estudiante en una tarjeta
    const infoRows: [string, string][] = [
      ['Nombre', detalle.nombre],
      ['RUT', detalle.rut],
      ['Carrera / Plan', detalle.plan || '-'],
      ['Correo', detalle.email || '-'],
      ['Teléfono', detalle.fono ? String(detalle.fono) : '-'],
      ['Año de ingreso', detalle.anio_ingreso ? String(detalle.anio_ingreso) : '-'],
    ];

    const drawCard = (rows: [string, string][]) => {
      doc.setDrawColor('#d1d5db');
      doc.setFillColor('#ffffff');
      doc.setLineWidth(1.5);
      doc.roundedRect(
        marginX - 6,
        y - 10,
        doc.internal.pageSize.getWidth() - marginX * 2 + 12,
        rows.length * 26 + 24,
        6,
        6,
        'FD',
      );
      let ly = y + 8;
      doc.setFontSize(11);
      rows.forEach(([label, value]) => {
        doc.setTextColor('#6b7280');
        doc.setFont('helvetica', 'normal');
        doc.text(label + ':', marginX + 8, ly);
        doc.setTextColor('#111827');
        doc.setFont('helvetica', 'normal');
        const valueX = marginX + 170;
        doc.text(String(value), valueX, ly);
        ly += 26;
      });
      y = ly + 8;
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
      const split = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - marginX * 2);
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
