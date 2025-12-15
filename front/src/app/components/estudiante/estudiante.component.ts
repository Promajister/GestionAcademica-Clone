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

    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const marginX = 46;
    let y = 52;

    // Encabezado con logos
    doc.addImage(LOGO_UTA_BASE64, 'PNG', marginX, y - 12, 66, 66);
    doc.addImage(
      LOGO_FEH_BASE64,
      'PNG',
      doc.internal.pageSize.getWidth() - marginX - 66,
      y - 12,
      66,
      66,
    );

    doc.setFontSize(10);
    doc.setTextColor('#1f2937');
    doc.text('Universidad de Tarapacá', marginX + 78, y + 6);
    doc.text('Facultad de Educación y Humanidades', marginX + 78, y + 20);
    doc.text('Departamento de Prácticas Pedagógicas', marginX + 78, y + 34);

    y += 78;

    doc.setFontSize(11);
    doc.setTextColor('#111827');
    doc.text('Ficha de Estudiante - Registro Académico y Prácticas', marginX, y);
    y += 18;

    const detalle = this.detalle;
    const infoRows: [string, string][] = [
      ['Nombre', detalle.nombre],
      ['RUT', detalle.rut],
      ['Carrera / Plan', detalle.plan || '-'],
      ['Correo', detalle.email || '-'],
      ['Teléfono', detalle.fono ? String(detalle.fono) : '-'],
      ['Año de ingreso', detalle.anio_ingreso ? String(detalle.anio_ingreso) : '-'],
    ];

    const drawCard = (rows: [string, string][]) => {
      doc.setDrawColor('#e5e7eb');
      doc.setFillColor('#f9fafb');
      doc.roundedRect(
        marginX - 6,
        y - 10,
        doc.internal.pageSize.getWidth() - marginX * 2 + 12,
        rows.length * 24 + 20,
        8,
        8,
        'FD',
      );
      let ly = y + 6;
      doc.setFontSize(11);
      rows.forEach(([label, value]) => {
        doc.setTextColor('#6b7280');
        doc.text(label, marginX + 6, ly);
        doc.setTextColor('#111827');
        doc.text(String(value), marginX + 160, ly);
        ly += 24;
      });
      y = ly + 6;
    };

    drawCard(infoRows);

    const sectionTitle = (title: string) => {
      doc.setTextColor('#1f2937');
      doc.setFontSize(13);
      doc.text(title, marginX, y);
      y += 10;
    };

    const bodyText = (text: string) => {
      doc.setFontSize(11);
      doc.setTextColor('#374151');
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
        doc.setFontSize(11);
        doc.setTextColor('#0f172a');
        doc.text(
          `${idx + 1}. ${this.estadoLabel(p.estado)} • ${this.formatearFecha(p.fecha_inicio)} - ${this.formatearFecha(p.fecha_termino)}`,
          marginX,
          y,
        );
        y += 14;
        const detalles: string[] = [];
        if (p.tipo) detalles.push(`Tipo: ${p.tipo}`);
        if (p.centro?.nombre) detalles.push(`Centro: ${p.centro.nombre}`);
        if (detalles.length) {
          bodyText(detalles.join(' • '));
        }
        y += 6;
      });
    } else {
      bodyText('Sin prácticas registradas.');
      y += 8;
    }

    // Actividades asociadas
    sectionTitle('Actividades asociadas');
    if (detalle.actividades?.length) {
      detalle.actividades.forEach((a, idx) => {
        if (y > doc.internal.pageSize.getHeight() - 100) {
          doc.addPage();
          y = 52;
        }
        doc.setFontSize(11);
        doc.setTextColor('#0f172a');
        doc.text(`${idx + 1}. ${a.nombre_actividad} • ${this.formatearFecha(a.fecha)}`, marginX, y);
        y += 14;
        if (a.lugar) {
          doc.setFontSize(10);
          doc.setTextColor('#6b7280');
          doc.text(`Lugar: ${a.lugar}`, marginX, y);
          y += 12;
        }
      });
    } else {
      bodyText('Sin actividades asociadas.');
    }

    doc.save(`estudiante_${detalle.rut}.pdf`);
  }
}
