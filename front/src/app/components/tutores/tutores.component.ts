import { Component, inject, PLATFORM_ID, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { TutoresService, Tutor } from '../../services/tutores.service';
import { MatProgressSpinner } from "@angular/material/progress-spinner";

interface TutorForm {
  rut: string;
  nombre: string;
  correo?: string;
  telefono?: string | number;
  cargo1?: string;
  cargo2?: string;
  universidad_egreso?: string;
  direccion?: string;
}

@Component({
  standalone: true,
  selector: 'app-tutores',
  templateUrl: './tutores.component.html',
  styleUrls: ['./tutores.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatPaginatorModule,
    MatProgressSpinner
],
})
export class TutoresComponent implements OnInit {
  private snack = inject(MatSnackBar);
  private tutoresService = inject(TutoresService);
  private fb = inject(FormBuilder);
  private platformId = inject(PLATFORM_ID);

  mostrarFormulario = false;
  tutorSeleccionado: Tutor | null = null;
  estaEditando = false;
  tutorEditando: Tutor | null = null;
  mostrarConfirmarEliminar = false;
  tutorAEliminar: Tutor | null = null;
  cargando = false;

  terminoBusqueda = '';

  formularioTutor!: FormGroup;

  // ===== permisos =====
  soloLecturaVinculacion = false;

  // Verificar si el usuario es jefatura (solo lectura)
  get esJefatura(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      const roleStr = localStorage.getItem('app.selectedRole');
      if (!roleStr) return false;
      const role = JSON.parse(roleStr);
      return role?.id === 'jefatura';
    } catch {
      return false;
    }
  }

  // Rol vinculacion solo lectura (igual que en centros)
  private esRolVinculacionSoloLectura(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      const saved = localStorage.getItem('app.selectedRole');
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      return parsed?.id === 'vinculacion';
    } catch {
      return false;
    }
  }

  // Está en modo solo lectura si es jefatura o vinculacion
  get esSoloLectura(): boolean {
    return this.esJefatura || this.soloLecturaVinculacion;
  }

  // ===== paginación =====
  pageIndex = 0;
  pageSize = 5;
  totalItems = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];

  // Datos - todos los tutores cargados del backend
  todosLosTutores: Tutor[] = [];

  constructor() {
    this.inicializarFormulario();
    this.load();
  }

  ngOnInit(): void {
    this.soloLecturaVinculacion = this.esRolVinculacionSoloLectura();

    // Asegurar que en solo lectura no quede el formulario abierto
    if (this.esSoloLectura) {
      this.mostrarFormulario = false;
      this.estaEditando = false;
    }
  }

  // ===== validaciones =====
  validarRut(control: AbstractControl): ValidationErrors | null {
    const rut = control.value;
    if (!rut) return null;

    const rutLimpio = rut.replace(/\./g, '').replace(/-/g, '').trim();

    if (rutLimpio.length < 3 || rutLimpio.length > 20) {
      return {
        rutInvalido: true,
        mensaje: 'RUT debe tener entre 3 y 20 caracteres',
      };
    }

    const rutRegex = /^[0-9]+[0-9kK]?$/;
    if (!rutRegex.test(rutLimpio)) {
      return {
        rutInvalido: true,
        mensaje:
          'RUT solo puede contener números y letra K (ej: 12345678-9 o 12345678-K)',
      };
    }

    return null;
  }

  validarTelefono(control: AbstractControl): ValidationErrors | null {
    const telefono = control.value;
    if (!telefono) return null;

    const telefonoStr = String(telefono);

    if (!/^\d+$/.test(telefonoStr)) {
      return {
        telefonoInvalido: true,
        mensaje: 'El teléfono debe contener solo números',
      };
    }

    // Verificar máximo 8 dígitos
    if (telefonoStr.length > 8) {
      return {
        telefonoInvalido: true,
        mensaje: 'El teléfono debe tener máximo 8 dígitos',
      };
    }

    const num = Number(telefono);
    if (isNaN(num) || num < 0) {
      return {
        telefonoInvalido: true,
        mensaje: 'El teléfono debe ser un número válido',
      };
    }

    return null;
  }

  inicializarFormulario() {
    this.formularioTutor = this.fb.group({
      rut: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(20),
          this.validarRut.bind(this),
        ],
      ],
      nombre: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(120),
        ],
      ],
      correo: ['', [Validators.email]],
      telefono: ['', [this.validarTelefono.bind(this)]],
      direccion: [''],
      cargo1: [''],
      cargo2: [''],
      universidad_egreso: [''],
    });
  }

  // ===== carga lista desde backend (todos los items para filtrado local) =====
  load() {
    this.cargando = true;

    const params: any = {
      page: 1,
      limit: 1000,
      orderBy: 'nombre',
      orderDir: 'asc',
    };

    this.tutoresService.listar(params).subscribe({
      next: (response) => {
        this.todosLosTutores = response.items || [];
        this.cargando = false;
        this.actualizarPaginacion();
      },
      error: (err) => {
        console.error('Error al cargar tutores:', err);
        this.snack.open('Error al cargar tutores', 'Cerrar', {
          duration: 3000,
        });
        this.cargando = false;
      },
    });
  }

  // Actualizar paginación cuando cambian los filtros o datos
  actualizarPaginacion() {
    this.totalItems = this.filtrados.length;
    const maxPage = Math.max(0, Math.ceil(this.totalItems / this.pageSize) - 1);
    if (this.pageIndex > maxPage) {
      this.pageIndex = maxPage;
    }
  }

  // Cargar tutores (para cuando se agrega/edita/elimina)
  cargarTutores() {
    this.load();
  }

  verDetalles(tutor: Tutor) {
    this.tutorSeleccionado = tutor;
  }

  cerrarDetalles() {
    this.tutorSeleccionado = null;
  }

  alternarFormulario() {
    // Si es jefatura o vinculacion, no permitir abrir el formulario
    if (this.esSoloLectura) return;

    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) {
      this.estaEditando = false;
      this.tutorEditando = null;
      this.resetearFormulario();
    } else if (!this.estaEditando) {
      this.inicializarFormulario();
    }
  }

  agregarTutor() {
    if (this.esSoloLectura) return;

    if (this.formularioTutor.invalid) {
      this.formularioTutor.markAllAsTouched();
      const errores = this.obtenerErrores();
      if (errores.length > 0) {
        this.snack.open(errores[0], 'Cerrar', { duration: 4000 });
      } else {
        this.snack.open(
          'Por favor, completa todos los campos requeridos correctamente',
          'Cerrar',
          { duration: 3000 },
        );
      }
      return;
    }

    const valores = this.formularioTutor.value as TutorForm;

    const datosParaEnviar: any = {
      rut: valores.rut?.trim(),
      nombre: valores.nombre?.trim(),
    };

    if (valores.correo?.trim()) {
      datosParaEnviar.correo = valores.correo.trim();
    }
    if (valores.telefono) {
      datosParaEnviar.telefono = Number(valores.telefono);
    }
    if (valores.direccion?.trim()) {
      datosParaEnviar.direccion = valores.direccion.trim();
    }
    const cargos: string[] = [valores.cargo1, valores.cargo2]
      .filter((c): c is string => !!c && !!c.trim())
      .map((c) => c.trim());
    if (cargos.length) datosParaEnviar.cargos = cargos;
    if (valores.universidad_egreso?.trim()) {
      datosParaEnviar.universidad_egreso = valores.universidad_egreso.trim();
    }

    this.tutoresService.crear(datosParaEnviar).subscribe({
      next: () => {
        this.snack.open(
          `✓ ${datosParaEnviar.nombre} agregado correctamente`,
          'Cerrar',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['success-snackbar'],
          },
        );
        this.resetearFormulario();
        this.mostrarFormulario = false;
        this.load();
      },
      error: (err) => {
        console.error('Error al crear tutor:', err);
        let mensajeError = 'Error al crear tutor';

        if (err?.error?.message) {
          mensajeError = err.error.message;
        } else if (err?.error?.error) {
          mensajeError = err.error.error;
        } else if (Array.isArray(err?.error?.message)) {
          mensajeError = err.error.message.join(', ');
        }

        this.snack.open(mensajeError, 'Cerrar', { duration: 4000 });
      },
    });
  }

  eliminar(tutor: Tutor) {
    // Si es jefatura o vinculacion, no permitir eliminar
    if (this.esSoloLectura) return;

    this.tutorAEliminar = tutor;
    this.mostrarConfirmarEliminar = true;
  }

  confirmarEliminar() {
    if (this.esSoloLectura) return;

    if (this.tutorAEliminar?.id) {
      this.tutoresService.eliminar(this.tutorAEliminar.id).subscribe({
        next: () => {
          this.snack.open(
            `✓ ${this.tutorAEliminar!.nombre} eliminado exitosamente`,
            'Cerrar',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
              panelClass: ['success-snackbar'],
            },
          );
          this.cerrarConfirmarEliminar();
          this.load();
          // Ajustar página si es necesario después de eliminar
          setTimeout(() => {
            if (this.tutores.length === 0 && this.pageIndex > 0) {
              this.pageIndex--;
              this.actualizarPaginacion();
            }
          }, 100);
        },
        error: (err) => {
          console.error('Error al eliminar tutor:', err);
          this.snack.open('Error al eliminar tutor', 'Cerrar', {
            duration: 3000,
          });
        },
      });
    }
  }

  cerrarConfirmarEliminar() {
    this.mostrarConfirmarEliminar = false;
    this.tutorAEliminar = null;
  }

  // ===== filtros - aplicados localmente en el frontend =====
  get filtrados(): Tutor[] {
    let resultado = [...this.todosLosTutores];

    // Filtrar por término de búsqueda (búsqueda inteligente)
    if (this.terminoBusqueda.trim()) {
      const termino = this.terminoBusqueda.trim().toLowerCase();
      resultado = resultado.filter((tutor) => {
        const nombre = (tutor.nombre || '').toLowerCase();
        const correo = (tutor.correo || '').toLowerCase();
        const cargo = (tutor.cargo || '').toLowerCase();
        const rut = (tutor.rut || '').toLowerCase();
        const direccion = (tutor.direccion || '').toLowerCase();
        const universidad = (tutor.universidad_egreso || '').toLowerCase();

        return (
          nombre.includes(termino) ||
          correo.includes(termino) ||
          cargo.includes(termino) ||
          rut.includes(termino) ||
          direccion.includes(termino) ||
          universidad.includes(termino)
        );
      });
    }

    return resultado;
  }

  // ===== items paginados de los filtrados =====
  get tutores(): Tutor[] {
    const filtrados = this.filtrados;
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return filtrados.slice(startIndex, endIndex);
  }

  // ===== orden, filtros y paginador =====
  onFiltersChange() {
    this.pageIndex = 0;
    this.actualizarPaginacion();
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    // No necesitamos recargar, solo actualizar la paginación
    this.actualizarPaginacion();
  }

  editarTutor(tutor: Tutor) {
    // Si es jefatura o vinculacion, no permitir editar
    if (this.esSoloLectura) return;

    this.estaEditando = true;
    this.tutorEditando = tutor;
    this.tutorSeleccionado = null;

    const [c1, c2] = (tutor.cargo || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.formularioTutor.patchValue({
      rut: tutor.rut || '',
      nombre: tutor.nombre || '',
      correo: tutor.correo || '',
      cargo1: c1 || '',
      cargo2: c2 || '',
      universidad_egreso: tutor.universidad_egreso || '',
      telefono: tutor.telefono || '',
      direccion: tutor.direccion || '',
    });

    this.mostrarFormulario = true;
  }

  actualizarTutor() {
    if (this.esSoloLectura) return;

    const tutorOriginal = this.tutorEditando;

    if (this.formularioTutor.invalid) {
      this.formularioTutor.markAllAsTouched();
      const errores = this.obtenerErrores();
      if (errores.length > 0) {
        this.snack.open(errores[0], 'Cerrar', { duration: 4000 });
      } else {
        this.snack.open(
          'Por favor, completa todos los campos requeridos correctamente',
          'Cerrar',
          { duration: 3000 },
        );
      }
      return;
    }

    if (!tutorOriginal?.id) {
      this.snack.open(
        'Error: No se pudo identificar el tutor a actualizar',
        'Cerrar',
        { duration: 3000 },
      );
      return;
    }

    const valores = this.formularioTutor.value as TutorForm;

    // En actualización, enviamos todos los campos (incluyendo null para vaciar)
    const datosParaEnviar: any = {
      rut: valores.rut?.trim(),
      nombre: valores.nombre?.trim(),
      correo: valores.correo?.trim() || null,
      telefono: valores.telefono ? Number(valores.telefono) : null,
      direccion: valores.direccion?.trim() || null,
      universidad_egreso: valores.universidad_egreso?.trim() || null,
    };

    const cargosUpd: string[] = [valores.cargo1, valores.cargo2]
      .filter((c): c is string => !!c && !!c.trim())
      .map((c) => c.trim());
    datosParaEnviar.cargos = cargosUpd;

    this.tutoresService.actualizar(tutorOriginal.id, datosParaEnviar).subscribe({
      next: () => {
        this.snack.open(
          `✓ ${datosParaEnviar.nombre} actualizado exitosamente`,
          'Cerrar',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['success-snackbar'],
          },
        );
        this.resetearFormulario();
        this.estaEditando = false;
        this.tutorEditando = null;
        this.mostrarFormulario = false;
        this.load();
      },
      error: (err) => {
        console.error('Error al actualizar tutor:', err);
        let mensajeError = 'Error al actualizar tutor';

        if (err?.error?.message) {
          mensajeError = err.error.message;
        } else if (err?.error?.error) {
          mensajeError = err.error.error;
        } else if (Array.isArray(err?.error?.message)) {
          mensajeError = err.error.message.join(', ');
        }

        this.snack.open(mensajeError, 'Cerrar', { duration: 4000 });
      },
    });
  }

  private resetearFormulario() {
    this.inicializarFormulario();
  }

  obtenerErrores(): string[] {
    const errores: string[] = [];
    const form = this.formularioTutor;

    if (form.get('rut')?.hasError('required')) {
      errores.push('El RUT es obligatorio');
    } else if (form.get('rut')?.hasError('minlength')) {
      errores.push('El RUT debe tener al menos 3 caracteres');
    } else if (form.get('rut')?.hasError('maxlength')) {
      errores.push('El RUT no puede tener más de 20 caracteres');
    } else if (form.get('rut')?.hasError('rutInvalido')) {
      errores.push(form.get('rut')?.errors?.['mensaje'] || 'RUT inválido');
    }

    if (form.get('nombre')?.hasError('required')) {
      errores.push('El nombre es obligatorio');
    } else if (form.get('nombre')?.hasError('minlength')) {
      errores.push('El nombre debe tener al menos 3 caracteres');
    } else if (form.get('nombre')?.hasError('maxlength')) {
      errores.push('El nombre no puede tener más de 120 caracteres');
    }

    if (form.get('correo')?.hasError('email')) {
      errores.push('El correo electrónico no tiene un formato válido');
    }

    if (form.get('telefono')?.hasError('telefonoInvalido')) {
      errores.push(
        form.get('telefono')?.errors?.['mensaje'] || 'Teléfono inválido',
      );
    }

    return errores;
  }

  getErrorRut(): string {
    const control = this.formularioTutor.get('rut');
    if (control?.hasError('required')) return 'El RUT es obligatorio';
    if (control?.hasError('minlength'))
      return 'El RUT debe tener al menos 3 caracteres';
    if (control?.hasError('maxlength'))
      return 'El RUT no puede tener más de 20 caracteres';
    if (control?.hasError('rutInvalido'))
      return control.errors?.['mensaje'] || 'RUT inválido';
    return '';
  }

  getErrorNombre(): string {
    const control = this.formularioTutor.get('nombre');
    if (control?.hasError('required')) return 'El nombre es obligatorio';
    if (control?.hasError('minlength'))
      return 'El nombre debe tener al menos 3 caracteres';
    if (control?.hasError('maxlength'))
      return 'El nombre no puede tener más de 120 caracteres';
    return '';
  }

  getErrorCorreo(): string {
    const control = this.formularioTutor.get('correo');
    if (control?.hasError('email')) return 'Correo electrónico inválido';
    return '';
  }

  getErrorTelefono(): string {
    const control = this.formularioTutor.get('telefono');
    if (control?.hasError('telefonoInvalido'))
      return control.errors?.['mensaje'] || 'Teléfono inválido';
    return '';
  }

  aplicarFiltros() {
    this.onFiltersChange();
  }

  limpiarFiltros() {
    this.terminoBusqueda = '';
    this.onFiltersChange();
  }
}
