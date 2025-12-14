import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

const API_URL = `${environment.apiUrl}/usuarios`;

export interface Permiso {
  id: number;
  clave: string;
  descripcion: string;
}

export interface Rol {
  id: number;
  clave: string;
  nombre: string;
  permisos: Permiso[];
}

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  role: string;
  rolId?: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  rol?: Rol;
}

export interface CreateUsuarioDto {
  email: string;
  nombre: string;
  role: 'jefatura' | 'vinculacion' | 'practicas';
  password: string;
  activo?: boolean;
  rolId?: number;
}

export interface UpdateUsuarioDto {
  email?: string;
  nombre?: string;
  role?: 'jefatura' | 'vinculacion' | 'practicas';
  password?: string;
  activo?: boolean;
  rolId?: number;
}

export interface UpdateEstadoDto {
  activo: boolean;
}

export interface UpdateRolPermisosDto {
  permisosIds: number[];
}

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  /**
   * Obtener headers con el rol del usuario
   */
  private getHeaders(): HttpHeaders {
    const user = this.authService.getCurrentUser();
    const role = user?.role || 'jefatura'; // Por defecto jefatura si no hay usuario
    return new HttpHeaders({
      'x-role': role
    });
  }

  /**
   * Obtener lista de usuarios
   */
  listar(incluirInactivos: boolean = false): Observable<Usuario[]> {
    const params = new HttpParams().set('incluirInactivos', incluirInactivos.toString());
    return this.http.get<Usuario[]>(API_URL, { 
      params,
      headers: this.getHeaders()
    });
  }

  /**
   * Crear un nuevo usuario
   */
  crear(usuario: CreateUsuarioDto): Observable<Usuario> {
    return this.http.post<Usuario>(API_URL, usuario, {
      headers: this.getHeaders()
    });
  }

  /**
   * Actualizar un usuario existente
   */
  actualizar(id: number, usuario: UpdateUsuarioDto): Observable<Usuario> {
    return this.http.patch<Usuario>(`${API_URL}/${id}`, usuario, {
      headers: this.getHeaders()
    });
  }

  /**
   * Actualizar estado de un usuario
   */
  actualizarEstado(id: number, activo: boolean): Observable<Usuario> {
    return this.http.patch<Usuario>(`${API_URL}/${id}/estado`, { activo }, {
      headers: this.getHeaders()
    });
  }

  /**
   * Obtener lista de roles con permisos
   */
  obtenerRoles(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${API_URL}/roles`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Obtener lista de permisos disponibles
   */
  obtenerPermisos(): Observable<Permiso[]> {
    return this.http.get<Permiso[]>(`${API_URL}/permisos/lista`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Actualizar permisos de un rol
   */
  actualizarPermisosRol(rolId: number, permisosIds: number[]): Observable<Rol> {
    return this.http.patch<Rol>(`${API_URL}/roles/${rolId}/permisos`, { permisosIds }, {
      headers: this.getHeaders()
    });
  }
}

