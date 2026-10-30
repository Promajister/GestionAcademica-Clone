import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Interfaces basadas en lo que devuelve tu backend
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
  // Ajusta este puerto si tu backend corre en uno distinto al 3000
  private apiUrl = 'http://localhost:3000/api/carga-docente'; 

  constructor(private http: HttpClient) {}

  obtenerProfesores(): Observable<ProfesorAsignable[]> {
    return this.http.get<ProfesorAsignable[]>(`${this.apiUrl}/profesores`);
  }

  obtenerCursos(semestre: number, year: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/cursos?semestre=${semestre}&year=${year}`);
  }

  asignarCarga(payload: AsignarCargaPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/asignar`, payload);
  }
  eliminarCarga(id_curso: number, id_usuario: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/eliminar/${id_curso}/${id_usuario}`);
  }
}
