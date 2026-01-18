import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type SubtipoEncuestaBidireccional =
  | 'AULA_ABIERTA_RECORRIDO_PEDAGOGICO'
  | 'ALTERNANCIAS_PREGRADO'
  | 'ALTERNANCIAS_RECEPTORES';

export interface EncuestaJefaturaPayload {
  tipo: 'JEFATURA_CARRERA';
  anioEncuesta: number;
  semestreEncuesta: 1 | 2;
  data: {
    subtipo: SubtipoEncuestaBidireccional;
    identificacion: Record<string, any>;
    secciones: Record<string, any>;
    abiertas: Record<string, string>;
  };
}

@Injectable({ providedIn: 'root' })
export class EncuestaJefaturaService {
  private baseUrl = `${environment.apiUrl}/encuestas-jefatura`;

  constructor(private http: HttpClient) {}

  crear(payload: EncuestaJefaturaPayload): Observable<any> {
    return this.http.post(this.baseUrl, payload);
  }

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }
}

