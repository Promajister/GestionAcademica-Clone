import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { SalasApiService, SalaDTO, TipoSala } from '../../services/salas-api.service';

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
    { valor: 'REUNION', label: 'Sala de reunión' },
  ];

  constructor() {
    this.form = this.fb.group({
      codigo: ['', [Validators.required, Validators.maxLength(30)]],
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
        this.snack.open('Error al cargar salas: ' + (err.error?.message || err.message), 'Cerrar', {
          duration: 4000,
        });
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
        s.nombre.toLowerCase().includes(q) ||
        s.codigo.toLowerCase().includes(q) ||
        s.tipo.toLowerCase().includes(q)
    );
  }

  abrirCrear(): void {
    this.salaEditando = null;
    this.errorBackend = null;
    this.form.reset({
      codigo: '',
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
      codigo: s.codigo,
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
      this.api.actualizar(this.salaEditando.id_sala, valor).subscribe({
        next: (actualizada) => {
          this.guardando = false;
          this.snack.open(`Sala "${actualizada.nombre}" actualizada exitosamente`, 'Cerrar', {
            duration: 3500,
          });
          this.cerrarModal();
          this.cargarSalas();
        },
        error: (err) => {
          this.guardando = false;
          const msg = err.error?.message || 'Error al actualizar sala';
          this.errorBackend = msg;
          this.snack.open(msg, 'Cerrar', { duration: 5000 });
        },
      });
    } else {
      this.api.crear(valor).subscribe({
        next: (creada) => {
          this.guardando = false;
          this.snack.open(`Sala "${creada.nombre}" registrada exitosamente`, 'Cerrar', {
            duration: 3500,
          });
          this.cerrarModal();
          this.cargarSalas();
        },
        error: (err) => {
          this.guardando = false;
          const msg = err.error?.message || 'Error al crear sala';
          this.errorBackend = msg;
          this.snack.open(msg, 'Cerrar', { duration: 5000 });
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
    const s = this.salaPorEliminar;
    this.guardando = true;

    this.api.eliminar(s.id_sala).subscribe({
      next: (resp) => {
        this.guardando = false;
        this.salaPorEliminar = null;
        this.snack.open(resp.mensaje, 'Cerrar', { duration: 5000 });
        this.cargarSalas();
      },
      error: (err) => {
        this.guardando = false;
        this.salaPorEliminar = null;
        this.snack.open(err.error?.message || 'Error al eliminar sala', 'Cerrar', { duration: 5000 });
      },
    });
  }

  reactivar(s: SalaDTO): void {
    this.guardando = true;
    this.api.actualizar(s.id_sala, { activo: true }).subscribe({
      next: () => {
        this.guardando = false;
        this.snack.open(`Sala "${s.nombre}" reactivada correctamente`, 'Cerrar', { duration: 3500 });
        this.cargarSalas();
      },
      error: (err) => {
        this.guardando = false;
        this.snack.open(err.error?.message || 'Error al reactivar sala', 'Cerrar', { duration: 4000 });
      },
    });
  }

  estaEnUso(s: SalaDTO): boolean {
    return (s._count?.bloques_horarios ?? 0) > 0;
  }
}
