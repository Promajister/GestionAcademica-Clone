import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Interfaces basadas en lo que devuelve el backend
export interface ProfesorAsignable {
  id_usuario: number;
  nombre: string;
  contrato: string;
  total_horas_asignadas: number;
}

export interface AsignarCargaPayload {
  id_curso: number;
  profesores: { id_usuario: number; cantidad_horas: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class CargaDocenteService {
  private apiUrl = `${environment.apiUrl}/horario/carga-docente`;

  constructor(private http: HttpClient) {}

  // POST y DELETE exigen CsrfGuard: mismo token que guarda AuthService al iniciar sesión
  private csrfHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-CSRF-Token': localStorage.getItem('app.token') ?? '',
    });
  }

  obtenerProfesores(): Observable<ProfesorAsignable[]> {
    return this.http.get<ProfesorAsignable[]>(`${this.apiUrl}/profesores`);
  }

  obtenerCursos(semestre: number, year: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/cursos?semestre=${semestre}&year=${year}`);
  }

  asignarCarga(payload: AsignarCargaPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/asignar`, payload, {
      headers: this.csrfHeaders(),
    });
  }

  eliminarCarga(id_curso: number, id_usuario: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/eliminar/${id_curso}/${id_usuario}`, {
      headers: this.csrfHeaders(),
    });
  }
}
