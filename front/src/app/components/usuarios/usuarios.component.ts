import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';

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
    MatCheckboxModule
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
  mostrarModalPermisos = false;
  mostrarConfirmarGuardar = false;
  usuarioEditando: Usuario | null = null;
  rolEditando: Rol | null = null;
  formularioUsuario: FormGroup;
  formularioPermisos: FormGroup;
  guardando = false;
  datosPendientes: any = null;
  
  // Estado para expandir/colapsar permisos por usuario
  permisosExpandidos: { [key: number]: boolean } = {};

  constructor() {
    // Inicializar formulario de usuario
    this.formularioUsuario = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]],
      role: ['', Validators.required],
      activo: [true]
    });

    // Inicializar formulario de permisos
    this.formularioPermisos = this.fb.group({});
  }

  ngOnInit() {
    this.cargarUsuarios();
    this.cargarRoles();
    this.cargarPermisos();
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

  cargarPermisos() {
    this.usuariosService.obtenerPermisos().subscribe({
      next: (permisos) => {
        this.permisosDisponibles = permisos;
        // Inicializar controles del formulario de permisos
        const permisosControls: any = {};
        permisos.forEach((perm) => {
          permisosControls['perm_' + perm.id] = [false];
        });
        this.formularioPermisos = this.fb.group(permisosControls);
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
      case 'vinculacion':
        return '#e0f2f1';
      case 'practicas':
        return '#e3f2fd';
      case 'jefatura':
        return '#fff3e0';
      default:
        return '#f5f5f5';
    }
  }

  roleLabel(role: string): string {
    const rol = this.roles.find(r => r.clave === role);
    return rol ? rol.nombre || rol.clave : role;
  }

  label(permission: Permiso | string): string {
    if (typeof permission === 'string') {
      const perm = this.permisosDisponibles.find(p => p.clave === permission);
      return perm ? perm.descripcion || perm.clave : permission;
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

    // Preparar datos
    const datos = { ...this.formularioUsuario.value };
    
    // Buscar rolId basado en el role seleccionado
    const rolSeleccionado = this.roles.find(r => r.clave === datos.role);
    if (rolSeleccionado) {
      datos.rolId = rolSeleccionado.id;
    }

    // Si no hay password en edición, no enviarlo
    if (this.usuarioEditando && !datos.password) {
      delete datos.password;
    }

    // Guardar datos pendientes y mostrar confirmación
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

  seCambiaronOtrosCampos(): boolean {
    if (!this.usuarioEditando || !this.datosPendientes) return true; // Si es nuevo usuario, siempre hay cambios
    
    const datos = this.datosPendientes;
    const original = this.usuarioEditando;
    
    // Verificar si cambió nombre, email, role o activo (excluyendo password)
    return (
      datos.nombre !== original.nombre ||
      datos.email !== original.email ||
      datos.role !== original.role ||
      datos.activo !== original.activo
    );
  }

  gestionarPermisos(usuario: Usuario) {
    if (!usuario.rol) {
      this.snackBar.open('El usuario no tiene un rol asignado', 'Cerrar', { duration: 3000 });
      return;
    }

    this.rolEditando = usuario.rol;
    
    // Resetear formulario de permisos con los permisos actuales del rol
    this.permisosDisponibles.forEach((perm) => {
      const controlName = 'perm_' + perm.id;
      const tienePermiso = usuario.rol!.permisos?.some(p => p.id === perm.id) || false;
      const control = this.formularioPermisos.get(controlName);
      if (control) {
        control.setValue(tienePermiso);
      }
    });
    
    this.mostrarModalPermisos = true;
  }

  cerrarModalPermisos() {
    this.mostrarModalPermisos = false;
    this.rolEditando = null;
  }

  guardarPermisos() {
    if (!this.rolEditando) return;

    this.guardando = true;
    
    // Recopilar permisos seleccionados
    const permisosSeleccionados: number[] = [];
    this.permisosDisponibles.forEach((perm) => {
      const controlName = 'perm_' + perm.id;
      if (this.formularioPermisos.get(controlName)?.value) {
        permisosSeleccionados.push(perm.id);
      }
    });

    this.usuariosService.actualizarPermisosRol(this.rolEditando.id, permisosSeleccionados).subscribe({
      next: () => {
        this.snackBar.open('Permisos actualizados correctamente', 'Cerrar', { duration: 3000 });
        this.cerrarModalPermisos();
        this.cargarUsuarios();
        this.cargarRoles();
        this.guardando = false;
      },
      error: (error) => {
        console.error('Error al actualizar permisos:', error);
        this.snackBar.open('Error al actualizar permisos', 'Cerrar', { duration: 3000 });
        this.guardando = false;
      }
    });
  }

  getPermisoControl(permisoId: number): FormControl {
    return this.formularioPermisos.get('perm_' + permisoId) as FormControl;
  }

  togglePermisos(usuarioId: number) {
    this.permisosExpandidos[usuarioId] = !this.permisosExpandidos[usuarioId];
  }

  isPermisosExpandidos(usuarioId: number): boolean {
    return this.permisosExpandidos[usuarioId] || false;
  }

  getPermisosVisibles(permisos: Permiso[], usuarioId: number, limite: number = 3): Permiso[] {
    if (this.isPermisosExpandidos(usuarioId)) {
      return permisos;
    }
    return permisos.slice(0, limite);
  }
}
