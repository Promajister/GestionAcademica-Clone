import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TipoEncuestaEgresados = 'EMPLEABILIDAD' | 'ACREDITACION';

export interface EncuestaEgresadosPayload {
  tipo: 'EGRESADOS';
  anioEncuesta: number;
  semestreEncuesta: 1 | 2;
  data: {
    encuestaTipo: TipoEncuestaEgresados;
    generales?: Record<string, any>;
    insercion?: Record<string, any>;
    condiciones?: Record<string, any>;
    percepcion?: Record<string, any>;
    abiertas?: Record<string, any>;
  };
}

@Injectable({ providedIn: 'root' })
export class EncuestasEgresadosService {
  private baseUrl = `${environment.apiUrl}/encuestas-egresados`;

  constructor(private http: HttpClient) {}

  crear(payload: EncuestaEgresadosPayload): Observable<any> {
    return this.http.post(this.baseUrl, payload);
  }

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }
}
