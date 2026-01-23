import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
  estudiante: Estudiante;
  centro: CentroEducativo;
  colaboradores?: Colaborador[];
  tutores?: { tutor: Tutor; rol: string }[];
  actividades?: Actividad[];
  observaciones?: Observacion[];
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
export class EstudiantesEnPracticaComponent implements OnInit {
  private practicasService = inject(PracticasService);
  private observacionesService = inject(ObservacionesService);
  private snack = inject(MatSnackBar);
  private platformId = inject(PLATFORM_ID);

  // Filtros
  terminoBusqueda = '';
  estadoSeleccionado: 'all' | EstadoPractica = 'all';
  nivelSeleccionado: 'all' | string = 'all';

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

  niveles: string[] = [];

  ngOnInit(): void {
    this.cargarPracticas();
  }

  cargarPracticas() {
    this.cargando = true;
    this.practicasService.listar().subscribe({
      next: (practicas) => {
        this.practicas = practicas.map((p: any) => this.transformarPractica(p));
        this.recalcularNivelesDesdeDatos();
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
        convenio: p.centro?.convenio
      },
      colaboradores,
      tutores,
      actividades: p.actividades || []
    };
  }

  private recalcularNivelesDesdeDatos() {
    const set = new Set<string>();
    this.practicas.forEach(p => {
      const n = (p.estudiante?.nivel || '').trim();
      if (n) set.add(n);
    });
    this.niveles = Array.from(set).sort((a, b) => a.localeCompare(b));
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

      const coincideNivel = this.nivelSeleccionado === 'all' ||
        (practica.estudiante.nivel || '').toLowerCase() === this.nivelSeleccionado.toLowerCase();

      return coincideBusqueda && coincideEstado && coincideNivel;
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
  }

  cerrarDialogoCambioEstado() {
    this.mostrarDialogoNotaFinal = false;
    this.practicaANotar = null;
    this.notaFinalEditada = null;
    this.notaFinalError = null;
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
}

