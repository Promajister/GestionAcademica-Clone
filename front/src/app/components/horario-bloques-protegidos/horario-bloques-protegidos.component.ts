import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  HorarioApiService,
  BloqueProtegidoDTO,
  AlcanceBloqueProtegidoUI,
  DiaSemana,
  CarreraDTO,
  ProfesorItemDTO,
  BloqueGrillaDTO,
} from '../../services/horario-api.service';
import {
  HorarioGrillaComponent,
  CeldaGrilla,
} from '../horario-grilla/horario-grilla.component';

export function formatoAlcanceTexto(bp: {
  alcance: string;
  codigo_carrera?: string | null;
  semestre?: number | null;
  contrato?: string | null;
  profesor?: {
    usuario?: { nombre: string } | null;
  } | null;
}): string {
  switch (bp.alcance) {
    case 'UNIVERSIDAD':
      return 'Universidad';
    case 'FACULTAD':
      return 'Facultad';
    case 'CARRERA':
      return `Carrera ${bp.codigo_carrera ?? ''}`.trim();
    case 'ESTUDIANTES':
      return `Estudiantes ${bp.codigo_carrera ?? ''} (${bp.semestre ?? ''}° sem)`.trim();
    case 'PRACTICA_PREPRACTICA':
      return `Práctica ${bp.semestre ?? ''}° semestre (${bp.codigo_carrera ?? ''})`.trim();
    case 'ACADEMICOS':
      return bp.contrato ? `Académicos (${bp.contrato})` : 'Todos los académicos';
    case 'ACADEMICO_INDIVIDUAL':
      return bp.profesor?.usuario?.nombre
        ? `Docente: ${bp.profesor.usuario.nombre}`
        : 'Académico individual';
    default:
      return bp.alcance;
  }
}

@Component({
  standalone: true,
  selector: 'app-horario-bloques-protegidos',
  templateUrl: './horario-bloques-protegidos.component.html',
  styleUrls: ['./horario-bloques-protegidos.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    HorarioGrillaComponent,
  ],
})
export class HorarioBloquesProtegidosComponent implements OnInit {
  private horarioApi = inject(HorarioApiService);
  private snack = inject(MatSnackBar);

  bloques: BloqueProtegidoDTO[] = [];
  carreras: CarreraDTO[] = [];
  profesores: ProfesorItemDTO[] = [];
  grillaHorarios: BloqueGrillaDTO[] = [];

  cargando = false;
  guardando = false;
  cargandoProfesores = false;

  // Filtros de la lista
  filtroAlcance = '';
  filtroDia = '';

  // Formulario
  mostrarFormulario = true;
  editandoId: number | null = null;
  nombre = '';
  alcance: AlcanceBloqueProtegidoUI = 'UNIVERSIDAD';
  bloqueInicio = 5;
  bloqueFin = 6;

  // Días
  diasCheck: Record<DiaSemana, boolean> = {
    LUNES: false,
    MARTES: true,
    MIERCOLES: false,
    JUEVES: false,
    VIERNES: false,
  };

  readonly DIAS_LISTA: { dia: DiaSemana; label: string }[] = [
    { dia: 'LUNES', label: 'Lunes' },
    { dia: 'MARTES', label: 'Martes' },
    { dia: 'MIERCOLES', label: 'Miércoles' },
    { dia: 'JUEVES', label: 'Jueves' },
    { dia: 'VIERNES', label: 'Viernes' },
  ];

  // Campos condicionales
  codigoCarrera = '';
  semestre: number | null = 1;
  contrato: string = '';
  idUsuarioProfesor: number | null = null;

  // Modal confirmación eliminar
  bloquePorEliminar: BloqueProtegidoDTO | null = null;

  readonly ALCANCES: { valor: AlcanceBloqueProtegidoUI; label: string }[] = [
    { valor: 'UNIVERSIDAD', label: 'Universidad (Institucional)' },
    { valor: 'FACULTAD', label: 'Facultad' },
    { valor: 'CARRERA', label: 'Carrera' },
    { valor: 'ESTUDIANTES', label: 'Grupo de estudiantes (nivel)' },
    { valor: 'PRACTICA_PREPRACTICA', label: 'Práctica / Prepráctica' },
    { valor: 'ACADEMICOS', label: 'Todos los académicos' },
    { valor: 'ACADEMICO_INDIVIDUAL', label: 'Académico individual' },
  ];

  readonly SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;

    this.horarioApi.getGrilla().subscribe({
      next: (g) => (this.grillaHorarios = g),
      error: () => {},
    });

    this.horarioApi.getCarreras().subscribe({
      next: (c) => {
        this.carreras = c;
        if (c.length > 0 && !this.codigoCarrera) {
          this.codigoCarrera = c[0].codigo;
        }
      },
      error: () => {},
    });

    this.cargandoProfesores = true;
    this.horarioApi.getProfesoresBloquesProtegidos().subscribe({
      next: (p) => {
        this.profesores = p;
        this.cargandoProfesores = false;
      },
      error: () => {
        this.cargandoProfesores = false;
      },
    });

    this.cargarBloques();
  }

  cargarBloques(): void {
    this.cargando = true;
    this.horarioApi
      .getBloquesProtegidos({
        alcance: this.filtroAlcance || undefined,
        dia: this.filtroDia || undefined,
      })
      .subscribe({
        next: (res) => {
          this.bloques = res;
          this.cargando = false;
        },
        error: (err) => {
          this.cargando = false;
          this.snack.open(
            'Error al cargar bloques protegidos: ' +
              (err.error?.message || err.message),
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }

  onFiltrosChange(): void {
    this.cargarBloques();
  }

  // Atajos
  atajoManana(): void {
    this.bloqueInicio = 1;
    this.bloqueFin = 6;
  }

  atajoTarde(): void {
    this.bloqueInicio = 7;
    this.bloqueFin = 12;
  }

  // Vista previa dinámica en la grilla
  get previewCeldas(): CeldaGrilla[] {
    const celdas: CeldaGrilla[] = [];
    const diasSeleccionados = (
      Object.keys(this.diasCheck) as DiaSemana[]
    ).filter((d) => this.diasCheck[d]);

    const etiqueta = this.nombre.trim() || 'Bloque Protegido';
    const detalle = formatoAlcanceTexto({
      alcance: this.alcance,
      codigo_carrera: this.codigoCarrera,
      semestre: this.semestre,
      contrato: this.contrato,
      profesor: this.profesores.find((p) => p.id_usuario === this.idUsuarioProfesor),
    });

    for (const dia of diasSeleccionados) {
      celdas.push({
        dia,
        bloque_inicio: this.bloqueInicio,
        bloque_fin: this.bloqueFin,
        tipo: 'PROTEGIDO',
        etiqueta,
        detalle,
      });
    }

    return celdas;
  }

  guardar(): void {
    if (!this.nombre.trim()) {
      this.snack.open('El nombre del bloque protegido es obligatorio', 'Cerrar', {
        duration: 3500,
      });
      return;
    }

    const dias = (Object.keys(this.diasCheck) as DiaSemana[]).filter(
      (d) => this.diasCheck[d],
    );
    if (dias.length === 0) {
      this.snack.open('Selecciona al menos un día de la semana', 'Cerrar', {
        duration: 3500,
      });
      return;
    }

    if (this.bloqueFin < this.bloqueInicio) {
      this.snack.open(
        'El bloque de fin no puede ser menor al bloque de inicio',
        'Cerrar',
        { duration: 3500 },
      );
      return;
    }

    // Colación: no cruzar bloques 6 y 7
    if (this.bloqueInicio <= 6 && this.bloqueFin >= 7) {
      this.snack.open(
        'Un rango no puede cruzar la colación entre los bloques 6 y 7',
        'Cerrar',
        { duration: 4000 },
      );
      return;
    }

    // Validar destinatarios según alcance
    if (
      (this.alcance === 'CARRERA' ||
        this.alcance === 'ESTUDIANTES' ||
        this.alcance === 'PRACTICA_PREPRACTICA') &&
      !this.codigoCarrera
    ) {
      this.snack.open('Debes seleccionar una carrera', 'Cerrar', {
        duration: 3500,
      });
      return;
    }

    if (
      (this.alcance === 'ESTUDIANTES' ||
        this.alcance === 'PRACTICA_PREPRACTICA') &&
      !this.semestre
    ) {
      this.snack.open('Debes ingresar un semestre válido', 'Cerrar', {
        duration: 3500,
      });
      return;
    }

    if (this.alcance === 'ACADEMICO_INDIVIDUAL' && !this.idUsuarioProfesor) {
      this.snack.open('Debes seleccionar un académico', 'Cerrar', {
        duration: 3500,
      });
      return;
    }

    this.guardando = true;

    if (this.editandoId) {
      this.horarioApi
        .updateBloqueProtegido(this.editandoId, {
          nombre: this.nombre.trim(),
          alcance: this.alcance,
          bloque_inicio: this.bloqueInicio,
          bloque_fin: this.bloqueFin,
          codigo_carrera:
            this.alcance === 'CARRERA' ||
            this.alcance === 'ESTUDIANTES' ||
            this.alcance === 'PRACTICA_PREPRACTICA'
              ? this.codigoCarrera
              : undefined,
          semestre:
            this.alcance === 'ESTUDIANTES' ||
            this.alcance === 'PRACTICA_PREPRACTICA'
              ? Number(this.semestre)
              : undefined,
          contrato:
            this.alcance === 'ACADEMICOS' && this.contrato
              ? this.contrato
              : undefined,
          id_usuario:
            this.alcance === 'ACADEMICO_INDIVIDUAL' && this.idUsuarioProfesor
              ? this.idUsuarioProfesor
              : undefined,
        })
        .subscribe({
          next: () => {
            this.guardando = false;
            this.snack.open(
              'Bloque protegido actualizado correctamente',
              'Cerrar',
              { duration: 3000 },
            );
            this.limpiarFormulario();
            this.cargarBloques();
          },
          error: (err) => {
            this.guardando = false;
            const msg =
              err.error?.message || 'Error al actualizar el bloque protegido';
            this.snack.open(msg, 'Cerrar', { duration: 5000 });
          },
        });
    } else {
      this.horarioApi
        .createBloqueProtegido({
          nombre: this.nombre.trim(),
          alcance: this.alcance,
          dias,
          bloque_inicio: this.bloqueInicio,
          bloque_fin: this.bloqueFin,
          codigo_carrera:
            this.alcance === 'CARRERA' ||
            this.alcance === 'ESTUDIANTES' ||
            this.alcance === 'PRACTICA_PREPRACTICA'
              ? this.codigoCarrera
              : undefined,
          semestre:
            this.alcance === 'ESTUDIANTES' ||
            this.alcance === 'PRACTICA_PREPRACTICA'
              ? Number(this.semestre)
              : undefined,
          contrato:
            this.alcance === 'ACADEMICOS' && this.contrato
              ? this.contrato
              : undefined,
          id_usuario:
            this.alcance === 'ACADEMICO_INDIVIDUAL' && this.idUsuarioProfesor
              ? this.idUsuarioProfesor
              : undefined,
        })
        .subscribe({
          next: () => {
            this.guardando = false;
            this.snack.open(
              'Bloque protegido creado exitosamente',
              'Cerrar',
              { duration: 3000 },
            );
            this.limpiarFormulario();
            this.cargarBloques();
          },
          error: (err) => {
            this.guardando = false;
            const msg =
              err.error?.message || 'Error al guardar el bloque protegido';
            this.snack.open(msg, 'Cerrar', { duration: 5000 });
          },
        });
    }
  }

  editar(b: BloqueProtegidoDTO): void {
    this.editandoId = b.id_bloque_protegido;
    this.nombre = b.nombre;
    this.alcance = b.alcance;
    this.bloqueInicio = b.bloque_inicio;
    this.bloqueFin = b.bloque_fin;

    // Resetear días
    (Object.keys(this.diasCheck) as DiaSemana[]).forEach((d) => {
      this.diasCheck[d] = d === b.dia;
    });

    this.codigoCarrera = b.codigo_carrera ?? '';
    this.semestre = b.semestre ?? 1;
    this.contrato = b.contrato ?? '';
    this.idUsuarioProfesor = b.id_usuario ?? null;

    // Hacer scroll al formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion(): void {
    this.limpiarFormulario();
  }

  limpiarFormulario(): void {
    this.editandoId = null;
    this.nombre = '';
    this.alcance = 'UNIVERSIDAD';
    this.bloqueInicio = 5;
    this.bloqueFin = 6;
    this.diasCheck = {
      LUNES: false,
      MARTES: true,
      MIERCOLES: false,
      JUEVES: false,
      VIERNES: false,
    };
    this.codigoCarrera = this.carreras[0]?.codigo ?? '';
    this.semestre = 1;
    this.contrato = '';
    this.idUsuarioProfesor = null;
  }

  // Eliminar
  confirmarEliminar(b: BloqueProtegidoDTO): void {
    this.bloquePorEliminar = b;
  }

  cancelarEliminar(): void {
    this.bloquePorEliminar = null;
  }

  ejecutarEliminar(): void {
    if (!this.bloquePorEliminar) return;

    const id = this.bloquePorEliminar.id_bloque_protegido;
    this.horarioApi.deleteBloqueProtegido(id, true).subscribe({
      next: () => {
        this.snack.open('Bloque protegido eliminado correctamente', 'Cerrar', {
          duration: 3000,
        });
        this.bloquePorEliminar = null;
        this.cargarBloques();
      },
      error: (err) => {
        this.snack.open(
          'Error al eliminar: ' + (err.error?.message || err.message),
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  formatoAlcance(b: BloqueProtegidoDTO): string {
    return formatoAlcanceTexto(b);
  }

  formatoDestinatario(b: BloqueProtegidoDTO): string {
    switch (b.alcance) {
      case 'UNIVERSIDAD':
      case 'FACULTAD':
        return 'Toda la institución';
      case 'CARRERA':
        return b.carrera?.nombre || `Carrera ${b.codigo_carrera}`;
      case 'ESTUDIANTES':
        return `${b.carrera?.nombre || b.codigo_carrera} · ${b.semestre}° semestre`;
      case 'PRACTICA_PREPRACTICA':
        return `Práctica nivel ${b.semestre}° sem (${b.codigo_carrera})`;
      case 'ACADEMICOS':
        return b.contrato ? `Académicos contrato ${b.contrato}` : 'Todos los académicos';
      case 'ACADEMICO_INDIVIDUAL':
        return b.profesor?.usuario?.nombre || `Docente #${b.id_usuario}`;
      default:
        return '—';
    }
  }
}
