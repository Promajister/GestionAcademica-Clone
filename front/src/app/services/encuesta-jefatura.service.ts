import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';

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

    crear(payload: EncuestaJefaturaPayload) {
    console.log('PAYLOAD ENVIADO', payload);

    // Simula respuesta exitosa del backend
    return of({ ok: true }).pipe(delay(1000));
    }
}

