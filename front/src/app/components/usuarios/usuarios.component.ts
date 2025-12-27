import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';

// Servicios
import { UsuariosService, Usuario, Rol, Permiso } from '../../services/usuarios.service';

@Component({
  standalone: true,
  selector: 'app-usuarios',
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
  ]
})
export class UsuariosComponent implements OnInit {
  private usuariosService = inject(UsuariosService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  // Datos
  usuarios: Usuario[] = [];
  roles: Rol[] = [];
  permisosDisponibles: Permiso[] = [];
  loading = false;

  // Estados para modales
  mostrarModalUsuario = false;
  mostrarConfirmarGuardar = false;

  usuarioEditando: Usuario | null = null;
  formularioUsuario: FormGroup;
  guardando = false;
  datosPendientes: any = null;

  // Modal rápido cambiar rol
  mostrarModalCambiarRol = false;
  usuarioRolEditando: Usuario | null = null;
  formularioRol: FormGroup;
  permisosRolSeleccionado: Permiso[] = [];

  // Expandir/colapsar permisos por usuario
  permisosExpandidos: { [key: number]: boolean } = {};

  constructor() {
    this.formularioUsuario = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]],
      role: ['', Validators.required],
      activo: [true],
    });

    this.formularioRol = this.fb.group({
      role: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.cargarUsuarios();
    this.cargarRoles();
    this.cargarPermisos();

    // actualizar preview de permisos cuando cambia el rol en el modal rápido
    this.formularioRol.get('role')?.valueChanges.subscribe((roleClave: string) => {
      this.actualizarPreviewPermisos(roleClave);
    });
  }

  cargarUsuarios() {
    this.loading = true;
    this.usuariosService.listar(false).subscribe({
      next: (usuarios) => {
        this.usuarios = usuarios;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar usuarios:', error);
        const mensaje = error.error?.message || error.message || 'Error al cargar usuarios';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 4000 });
        this.loading = false;
      }
    });
  }

  cargarRoles() {
    this.usuariosService.obtenerRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
      },
      error: (error) => {
        console.error('Error al cargar roles:', error);
        const mensaje = error.error?.message || error.message || 'Error al cargar roles';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 3000 });
      }
    });
  }

  // Solo para "label()" bonito en chips
  cargarPermisos() {
    this.usuariosService.obtenerPermisos().subscribe({
      next: (permisos) => {
        this.permisosDisponibles = permisos;
      },
      error: (error) => {
        console.error('Error al cargar permisos:', error);
        const mensaje = error.error?.message || error.message || 'Error al cargar permisos';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 3000 });
      }
    });
  }

  roleColor(role: string) {
    switch (role) {
      case 'vinculacion': return '#e0f2f1';
      case 'practicas':   return '#e3f2fd';
      case 'jefatura':    return '#fff3e0';
      default:            return '#f5f5f5';
    }
  }

  roleLabel(role: string): string {
    const rol = this.roles.find(r => r.clave === role);
    return rol ? (rol.nombre || rol.clave) : role;
  }

  label(permission: Permiso | string): string {
    if (typeof permission === 'string') {
      const perm = this.permisosDisponibles.find(p => p.clave === permission);
      return perm ? (perm.descripcion || perm.clave) : permission;
    }
    return permission.descripcion || permission.clave;
  }

  getEstadoPillClass(activo: boolean): string {
    return activo ? 'pill--ok' : 'pill--bad';
  }

  abrirNuevoUsuario() {
    this.usuarioEditando = null;
    this.formularioUsuario.reset({
      nombre: '',
      email: '',
      password: '',
      role: '',
      activo: true
    });

    this.formularioUsuario.get('password')?.setValidators([Validators.required, Validators.minLength(4)]);
    this.formularioUsuario.get('password')?.updateValueAndValidity();

    this.mostrarModalUsuario = true;
  }

  editarUsuario(usuario: Usuario) {
    this.usuarioEditando = usuario;
    this.formularioUsuario.patchValue({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      role: usuario.role,
      activo: usuario.activo
    });

    this.formularioUsuario.get('password')?.clearValidators();
    this.formularioUsuario.get('password')?.setValidators([Validators.minLength(4)]);
    this.formularioUsuario.get('password')?.updateValueAndValidity();

    this.mostrarModalUsuario = true;
  }

  cerrarModalUsuario() {
    this.mostrarModalUsuario = false;
    this.usuarioEditando = null;
    this.formularioUsuario.reset();
  }

  guardarUsuario() {
    if (this.formularioUsuario.invalid) {
      this.formularioUsuario.markAllAsTouched();
      this.snackBar.open('Por favor completa todos los campos requeridos', 'Cerrar', { duration: 3000 });
      return;
    }

    const datos = { ...this.formularioUsuario.value };

    // rolId según rol.clave
    const rolSeleccionado = this.roles.find(r => r.clave === datos.role);
    if (rolSeleccionado) datos.rolId = rolSeleccionado.id;

    // si edita y no cambió password, no enviarlo
    if (this.usuarioEditando && !datos.password) delete datos.password;

    this.datosPendientes = datos;
    this.mostrarConfirmarGuardar = true;
  }

  cerrarConfirmarGuardar() {
    this.mostrarConfirmarGuardar = false;
    this.datosPendientes = null;
  }

  confirmarGuardarUsuario() {
    if (!this.datosPendientes) return;

    this.guardando = true;
    this.mostrarConfirmarGuardar = false;

    const operacion = this.usuarioEditando
      ? this.usuariosService.actualizar(this.usuarioEditando.id, this.datosPendientes)
      : this.usuariosService.crear(this.datosPendientes);

    operacion.subscribe({
      next: () => {
        this.snackBar.open(
          this.usuarioEditando ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente',
          'Cerrar',
          { duration: 3000 }
        );
        this.cerrarModalUsuario();
        this.cargarUsuarios();
        this.guardando = false;
        this.datosPendientes = null;
      },
      error: (error) => {
        console.error('Error al guardar usuario:', error);
        const mensaje = error.error?.message || 'Error al guardar usuario';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 3000 });
        this.guardando = false;
        this.datosPendientes = null;
      }
    });
  }

  seCambioPassword(): boolean {
    if (!this.usuarioEditando || !this.datosPendientes) return false;
    return !!this.datosPendientes.password && this.datosPendientes.password.trim() !== '';
  }

  // abrir modal rápido de rol
  abrirCambiarRol(usuario: Usuario) {
    this.usuarioRolEditando = usuario;
    this.mostrarModalCambiarRol = true;

    this.formularioRol.reset({ role: usuario.role });
    this.actualizarPreviewPermisos(usuario.role);
  }

  cerrarModalCambiarRol() {
    this.mostrarModalCambiarRol = false;
    this.usuarioRolEditando = null;
    this.formularioRol.reset();
    this.permisosRolSeleccionado = [];
  }

  private actualizarPreviewPermisos(roleClave: string) {
    const rol = this.roles.find(r => r.clave === roleClave);
    this.permisosRolSeleccionado = rol?.permisos ? [...rol.permisos] : [];
  }

  // guardar cambio de rol (sin permisos manuales)
  guardarCambioRol() {
    if (!this.usuarioRolEditando) return;
    if (this.formularioRol.invalid) {
      this.formularioRol.markAllAsTouched();
      return;
    }

    const role = this.formularioRol.value.role as string;
    const rolSeleccionado = this.roles.find(r => r.clave === role);

    if (!rolSeleccionado) {
      this.snackBar.open('Rol inválido', 'Cerrar', { duration: 2500 });
      return;
    }

    this.guardando = true;

    this.usuariosService.actualizar(this.usuarioRolEditando.id, {
      role: role as any,
      rolId: rolSeleccionado.id,
    }).subscribe({
      next: () => {
        this.snackBar.open('Rol actualizado correctamente', 'Cerrar', { duration: 3000 });
        this.cerrarModalCambiarRol();
        this.cargarUsuarios(); // refresca rol + permisos derivados
        this.guardando = false;
      },
      error: (error) => {
        console.error('Error al actualizar rol:', error);
        const mensaje = error.error?.message || 'Error al actualizar rol';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 3000 });
        this.guardando = false;
      }
    });
  }

  // ===== Expand/collapse permisos (solo UI) =====
  togglePermisos(usuarioId: number) {
    this.permisosExpandidos[usuarioId] = !this.permisosExpandidos[usuarioId];
  }

  isPermisosExpandidos(usuarioId: number): boolean {
    return this.permisosExpandidos[usuarioId] || false;
  }

  getPermisosVisibles(permisos: Permiso[], usuarioId: number, limite: number = 3): Permiso[] {
    return this.isPermisosExpandidos(usuarioId) ? permisos : permisos.slice(0, limite);
  }
}
