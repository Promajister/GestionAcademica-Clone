
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TipoContrato = 'PLANTA' | 'HORAS';

export interface ProfesorDTO {
  id_usuario: number;
  contrato: TipoContrato;

  usuario: {
    id: number;
    nombre: string;
    email: string;
    activo: boolean;
  };

  _count?: {
    cargaDocentes: number;
  };
}

export interface CreateProfesorPayload {
  id_usuario: number;
  contrato: TipoContrato;
}

export interface UpdateProfesorPayload {
  contrato?: TipoContrato;
}

export interface UsuarioDisponibleDTO {
  id: number;
  nombre: string;
  email: string;
  role: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProfesoresApiService {
  private http = inject(HttpClient);

  private readonly baseUrl =
    `${environment.apiUrl}/horario/profesores`;


  private getAuthHeaders(): HttpHeaders {
    const csrfToken =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('app.token')
        : null;

    return new HttpHeaders({
      'X-CSRF-Token': csrfToken || '',
    });
  }
  // Listar docentes
  listar(): Observable<ProfesorDTO[]> {
    return this.http.get<ProfesorDTO[]>(this.baseUrl);
  }

  // Obtener usuarios que aún no son docentes
  listarUsuariosDisponibles(): Observable<UsuarioDisponibleDTO[]> {
    return this.http.get<UsuarioDisponibleDTO[]>(
      `${this.baseUrl}/usuarios-disponibles`
    );
  }

  // Obtener docente
  obtener(id: number): Observable<ProfesorDTO> {
    return this.http.get<ProfesorDTO>(
      `${this.baseUrl}/${id}`
    );
  }

  // Registrar docente
  crear(
    payload: CreateProfesorPayload
  ): Observable<ProfesorDTO> {
    return this.http.post<ProfesorDTO>(
      this.baseUrl,
      payload,
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  // Actualizar contrato
  actualizar(
    id: number,
    payload: UpdateProfesorPayload
  ): Observable<ProfesorDTO> {
    return this.http.patch<ProfesorDTO>(
      `${this.baseUrl}/${id}`,
      payload,
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  // Eliminar docente
  eliminar(
    id: number
  ): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(
      `${this.baseUrl}/${id}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
  }
}

