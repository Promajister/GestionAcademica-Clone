// Servicio para consumir la API de encuestas (listado, creación, exportación y catálogos)
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


// Estructura base de una encuesta devuelta por la API
export interface ApiEncuesta {
  id: number | string;
  tipo?: string;
  fecha?: string;
  origenArchivo?: string;
  respuestas?: any[];
  [k: string]: any; // resto de campos dinámicos
}

// URL base del backend de encuestas
const API_URL = `${environment.apiUrl}/encuestas`;

@Injectable({
  providedIn: 'root'
})
export class EncuestasApiService {

  constructor(private http: HttpClient) {}

  // Obtiene todas las encuestas registradas (estudiantes + colaboradores)
  getEncuestasRegistradas(): Observable<ApiEncuesta[]> {
    return this.http.get<ApiEncuesta[]>(API_URL);
  }

  // Obtiene una encuesta específica por su ID
  getEncuestaById(id: number | string): Observable<any> {
    return this.http.get(`${API_URL}/${id}`);
  }

  // Crea una nueva encuesta
  createEncuesta(payload: any): Observable<any> {
    return this.http.post(API_URL, payload);
  }

  // Exporta todas las encuestas a un archivo Excel (blob)
  exportEncuestasExcel(): Observable<Blob> {
    return this.http.get(`${API_URL}/export/excel`, { responseType: 'blob' });
  }

  // ---------- CATÁLOGOS (para poblar selects) ----------
  // Rutas:
  // GET /encuestas/estudiantes
  // GET /encuestas/centros
  // GET /encuestas/colaboradores
  // GET /encuestas/tutores

  // Lista de estudiantes disponibles
  getEstudiantes(): Observable<{ rut: string; nombre: string }[]> {
    return this.http.get<{ rut: string; nombre: string }[]>(`${API_URL}/estudiantes`);
  }

  // Lista de centros educativos
  getCentros(): Observable<{ id: number; nombre: string; comuna?: string; region?: string }[]> {
    return this.http.get<{ id: number; nombre: string; comuna?: string; region?: string }[]>(`${API_URL}/centros`);
  }

  // Lista de profesores colaboradores
  getColaboradores(): Observable<{ id: number; nombre: string; rut: string }[]> {
    return this.http.get<{ id: number; nombre: string; rut: string
     }[]>(`${API_URL}/colaboradores`);
  }

  // Lista de tutores/supervisores
  getTutores(): Observable<{ id: number; nombre: string }[]> {
    return this.http.get<{ id: number; nombre: string }[]>(`${API_URL}/tutores`);
  }

  // Actualiza solo las respuestas abiertas de una encuesta existente
  actualizarRespuestasAbiertas(
    encuestaId: number | string,
    payload: { respuestas: { preguntaId: number; respuestaAbierta: string }[] }
  ): Observable<any> {
    return this.http.patch(`${API_URL}/${encuestaId}/abiertas`, payload);
  }
  
}
