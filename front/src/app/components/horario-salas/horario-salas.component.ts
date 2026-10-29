import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  SalasApiService,
  SalaDTO,
  TipoSala,
} from '../../services/salas-api.service';

@Component({
  standalone: true,
  selector: 'app-horario-salas',
  templateUrl: './horario-salas.component.html',
  styleUrls: ['./horario-salas.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
})
export class HorarioSalasComponent implements OnInit {
  private api = inject(SalasApiService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  salas: SalaDTO[] = [];
  cargando = false;
  guardando = false;

  // Filtros
  filtroTexto = '';
  soloActivas = false;

  // Modal Crear/Editar
  mostrarModal = false;
  salaEditando: SalaDTO | null = null;
  form: FormGroup;
  errorBackend: string | null = null;

  // Modal Eliminar
  salaPorEliminar: SalaDTO | null = null;

  readonly TIPOS: { valor: TipoSala; label: string }[] = [
    { valor: 'CLASES', label: 'Sala de clases' },
    { valor: 'REUNIONES', label: 'Sala de reunión' },
  ];

  constructor() {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      tipo: ['CLASES' as TipoSala, [Validators.required]],
      capacidad: [22, [Validators.required, Validators.min(1)]],
    });
  }

  ngOnInit(): void {
    this.cargarSalas();
  }

  cargarSalas(): void {
    this.cargando = true;
    this.api.listar(this.soloActivas).subscribe({
      next: (data) => {
        this.salas = data;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.snack.open(
          'Error al cargar salas: ' + (err.error?.message || err.message),
          'Cerrar',
          {
            duration: 4000,
          },
        );
      },
    });
  }

  onFiltroActivasChange(): void {
    this.cargarSalas();
  }

  get salasFiltradas(): SalaDTO[] {
    const q = this.filtroTexto.trim().toLowerCase();
    if (!q) return this.salas;
    return this.salas.filter(
      (s) =>
        s.nombre.toLowerCase().includes(q) || s.tipo.toLowerCase().includes(q),
    );
  }

  abrirCrear(): void {
    this.salaEditando = null;
    this.errorBackend = null;
    this.form.reset({
      nombre: '',
      tipo: 'CLASES',
      capacidad: 22,
    });
    this.mostrarModal = true;
  }

  abrirEditar(s: SalaDTO): void {
    this.salaEditando = s;
    this.errorBackend = null;
    this.form.patchValue({
      nombre: s.nombre,
      tipo: s.tipo,
      capacidad: s.capacidad,
    });
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.salaEditando = null;
    this.errorBackend = null;
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valor = this.form.value;
    this.guardando = true;
    this.errorBackend = null;

    if (this.salaEditando) {
      this.api
        .actualizar(this.salaEditando.id_sala, {
          nombre: valor.nombre,
          tipo: valor.tipo,
          capacidad: Number(valor.capacidad),
        })
        .subscribe({
          next: (res) => {
            this.guardando = false;
            this.snack.open(
              `Sala "${res.nombre}" actualizada con éxito`,
              'Cerrar',
              {
                duration: 3000,
              },
            );
            this.cerrarModal();
            this.cargarSalas();
          },
          error: (err) => {
            this.guardando = false;
            this.errorBackend =
              err.error?.message || 'Error al actualizar la sala';
            this.snack.open(this.errorBackend!, 'Cerrar', { duration: 5000 });
          },
        });
    } else {
      this.api
        .crear({
          nombre: valor.nombre,
          tipo: valor.tipo,
          capacidad: Number(valor.capacidad),
        })
        .subscribe({
          next: (res) => {
            this.guardando = false;
            this.snack.open(
              `Sala "${res.nombre}" creada con éxito`,
              'Cerrar',
              {
                duration: 3000,
              },
            );
            this.cerrarModal();
            this.cargarSalas();
          },
          error: (err) => {
            this.guardando = false;
            this.errorBackend = err.error?.message || 'Error al crear la sala';
            this.snack.open(this.errorBackend!, 'Cerrar', { duration: 5000 });
          },
        });
    }
  }

  pedirEliminar(s: SalaDTO): void {
    this.salaPorEliminar = s;
  }

  cerrarConfirmarEliminar(): void {
    this.salaPorEliminar = null;
  }

  confirmarEliminar(): void {
    if (!this.salaPorEliminar) return;

    const id = this.salaPorEliminar.id_sala;
    this.guardando = true;

    this.api.eliminar(id).subscribe({
      next: (res) => {
        this.guardando = false;
        this.snack.open(res.mensaje, 'Cerrar', { duration: 5000 });
        this.cerrarConfirmarEliminar();
        this.cargarSalas();
      },
      error: (err) => {
        this.guardando = false;
        const msg = err.error?.message || 'Error al procesar la eliminación';
        this.snack.open(msg, 'Cerrar', { duration: 5000 });
      },
    });
  }

  reactivar(s: SalaDTO): void {
    this.api.actualizar(s.id_sala, { activo: true }).subscribe({
      next: () => {
        this.snack.open(`Sala "${s.nombre}" reactivada con éxito`, 'Cerrar', {
          duration: 3000,
        });
        this.cargarSalas();
      },
      error: (err) => {
        const msg = err.error?.message || 'Error al reactivar sala';
        this.snack.open(msg, 'Cerrar', { duration: 4000 });
      },
    });
  }

  estaEnUso(s: SalaDTO): boolean {
    const c = s._count;
    if (!c) return false;
    return (
      (c.horarios ?? 0) > 0 ||
      (c.horariosExternos ?? 0) > 0 ||
      (c.ocupacionesPuntuales ?? 0) > 0 ||
      (c.bloques_horarios ?? 0) > 0 ||
      (c.ocupaciones ?? 0) > 0
    );
  }

  conteoUso(s: SalaDTO): number {
    const c = s._count;
    if (!c) return 0;
    return (
      (c.horariosExternos ?? 0) +
      (c.horarios ?? 0) +
      (c.ocupacionesPuntuales ?? 0) +
      (c.bloques_horarios ?? 0) +
      (c.ocupaciones ?? 0)
    );
  }
}
