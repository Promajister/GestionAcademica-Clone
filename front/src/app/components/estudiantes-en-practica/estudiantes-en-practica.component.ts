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
  pageSize = 5;
  totalItems = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];

  // Datos
  practicas: PracticaEstudiante[] = [];
  cargando = false;

  // Estado para diálogo de confirmación
  mostrarConfirmarCambioEstado = false;
  practicaACambiarEstado: PracticaEstudiante | null = null;
  nuevoEstadoSeleccionado: EstadoPractica | null = null;

  // Estado para modal de detalles
  mostrarModalDetalles = false;
  practicaSeleccionada: PracticaEstudiante | null = null;
  observaciones: Observacion[] = [];

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
        console.error('Error al cargar prácticas:', err);
        this.snack.open('Error al cargar estudiantes en práctica', 'Cerrar', { duration: 3000 });
        this.cargando = false;
      }
    });
  }

  transformarPractica(p: any): PracticaEstudiante {
    const formatearFecha = (fecha: any): string => {
      if (!fecha) return '';
      const date = new Date(fecha);
      return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
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
    this.practicaACambiarEstado = practica;
    this.nuevoEstadoSeleccionado = practica.estado;
    this.mostrarConfirmarCambioEstado = true;
  }

  cerrarDialogoCambioEstado() {
    this.mostrarConfirmarCambioEstado = false;
    this.practicaACambiarEstado = null;
    this.nuevoEstadoSeleccionado = null;
  }

  confirmarCambioEstado() {
    if (!this.practicaACambiarEstado || !this.nuevoEstadoSeleccionado) {
      return;
    }

    if (this.practicaACambiarEstado.estado === this.nuevoEstadoSeleccionado) {
      this.cerrarDialogoCambioEstado();
      return; // No hacer nada si el estado es el mismo
    }

    this.practicasService.actualizarEstado(
      this.practicaACambiarEstado.id,
      this.nuevoEstadoSeleccionado
    ).subscribe({
      next: (response) => {
        // Actualizar el estado en la lista local
        const index = this.practicas.findIndex(
          p => p.id === this.practicaACambiarEstado!.id
        );
        if (index !== -1) {
          this.practicas[index].estado = this.nuevoEstadoSeleccionado!;
        }
        
        this.actualizarPaginacion();
        
        this.snack.open(
          `✓ Estado actualizado a: ${this.formatearEstado(this.nuevoEstadoSeleccionado!)}`,
          'Cerrar',
          {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['success-snackbar']
          }
        );
        
        this.cerrarDialogoCambioEstado();
      },
      error: (err) => {
        console.error('Error al actualizar estado:', err);
        let mensaje = 'Error al actualizar el estado de la práctica';
        if (err.error && err.error.message) {
          mensaje = err.error.message;
        }
        this.snack.open(mensaje, 'Cerrar', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  verDetalles(practica: PracticaEstudiante) {
    this.practicaSeleccionada = practica;
    this.mostrarModalDetalles = true;
    this.cargarObservaciones(practica.id);
  }

  cerrarDetalles() {
    this.practicaSeleccionada = null;
    this.mostrarModalDetalles = false;
    this.observaciones = [];
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
    if (!fecha) return '';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
