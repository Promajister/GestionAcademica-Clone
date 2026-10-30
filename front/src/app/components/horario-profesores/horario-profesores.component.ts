
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  ProfesoresApiService,
  ProfesorDTO,
  TipoContrato,
  UsuarioDisponibleDTO,
} from '../../services/profesores-api.service';

@Component({
  selector: 'app-horario-profesores',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './horario-profesores.component.html',
  styleUrls: ['./horario-profesores.component.scss'],
})
export class HorarioProfesoresComponent implements OnInit {
  private api = inject(ProfesoresApiService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  profesores: ProfesorDTO[] = [];
  usuariosDisponibles: UsuarioDisponibleDTO[] = [];

  cargando = false;
  guardando = false;
  filtro = '';
  mostrarFormulario = false;
  profesorEditando: ProfesorDTO | null = null;

  form = this.fb.group({
    id_usuario: [null as number | null, [
      Validators.required,
      Validators.min(1),
    ]],
    contrato: ['HORAS' as TipoContrato, Validators.required],
  });

  ngOnInit(): void {
    this.cargarProfesores();
    this.cargarUsuariosDisponibles();
  }

  cargarProfesores(): void {
    this.cargando = true;

    this.api.listar().subscribe({
      next: (data) => {
        this.profesores = data;
        this.cargando = false;
      },
      error: (error) => {
        this.cargando = false;
        this.mostrarError(error, 'No se pudieron cargar los docentes');
      },
    });
  }

  cargarUsuariosDisponibles(): void {
    this.api.listarUsuariosDisponibles().subscribe({
      next: (usuarios) => {
        this.usuariosDisponibles = usuarios;
      },
      error: (error) => {
        this.mostrarError(
          error,
          'No se pudieron cargar los usuarios disponibles'
        );
      },
    });
  }

  get profesoresFiltrados(): ProfesorDTO[] {
    const texto = this.filtro.toLowerCase().trim();

    return this.profesores.filter((profesor) => {
      return (
        profesor.usuario.nombre.toLowerCase().includes(texto) ||
        profesor.usuario.email.toLowerCase().includes(texto)
      );
    });
  }

  buscar(event: Event): void {
    this.filtro = (event.target as HTMLInputElement).value;
  }

  abrirCrear(): void {
    this.profesorEditando = null;
    this.form.controls.id_usuario.enable();
      
    this.form.reset({
      id_usuario: null,
      contrato: 'HORAS',
    });

    this.mostrarFormulario = true;
  }

  abrirEditar(profesor: ProfesorDTO): void {
    this.profesorEditando = profesor;
    this.form.controls.id_usuario.disable();

    this.form.patchValue({
      id_usuario: profesor.id_usuario,
      contrato: profesor.contrato,
    });

    this.mostrarFormulario = true;
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.profesorEditando = null;
  }

  guardar(): void {
    if (this.form.invalid || this.guardando) {
      this.form.markAllAsTouched();
      return;
    }

    const valor = this.form.getRawValue();
    const contrato = valor.contrato as TipoContrato;

    this.guardando = true;

    if (this.profesorEditando) {
      this.api.actualizar(
        this.profesorEditando.id_usuario,
        { contrato }
      ).subscribe({
        next: () => {
          this.guardando = false;
          this.snack.open('Docente actualizado', 'Cerrar', {
            duration: 3000,
          });
          this.cerrarFormulario();
          this.cargarProfesores();
          this.cargarUsuariosDisponibles();
        },
        error: (error) => {
          this.guardando = false;
          this.mostrarError(error, 'No se pudo actualizar');
        },
      });

      return;
    }

    this.api.crear({
      id_usuario: Number(valor.id_usuario),
      contrato,
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.snack.open('Docente registrado', 'Cerrar', {
          duration: 3000,
        });
        this.cerrarFormulario();
        this.cargarProfesores();
      },
      error: (error) => {
        this.guardando = false;
        this.mostrarError(error, 'No se pudo registrar');
      },
    });
  }

  eliminar(profesor: ProfesorDTO): void {
    const nombre = profesor.usuario.nombre;

    if (!confirm(`¿Eliminar al docente ${nombre}?`)) {
      return;
    }

    this.api.eliminar(profesor.id_usuario).subscribe({
      next: () => {
        this.snack.open('Docente eliminado', 'Cerrar', {
          duration: 3000,
        });
        this.cargarProfesores();
      },
      error: (error) => {
        this.mostrarError(error, 'No se pudo eliminar');
      },
    });
  }

  puedeEliminar(profesor: ProfesorDTO): boolean {
    return (profesor._count?.cargaDocentes ?? 0) === 0;
  }

  puedeDeclararDisponibilidad(profesor: ProfesorDTO): boolean {
    return profesor.contrato === 'HORAS' && profesor.usuario.activo;
  }

  private mostrarError(error: any, mensaje: string): void {
    const detalle = error.error?.message;
    const texto = Array.isArray(detalle)
      ? detalle.join(', ')
      : detalle || mensaje;

    this.snack.open(texto, 'Cerrar', {
      duration: 5000,
    });
  }
}
