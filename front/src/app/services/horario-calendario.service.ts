import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SalaDTO } from './salas-api.service';

export interface DocenteCalendarioDTO {
  id_usuario: number;
  nombre: string;
  contrato: string;
}

export interface OcupacionCelda {
  id_sala: number;
  id_dia: number;
  id_bloque: number;
  id_usuario: number;
  tipo: 'INTERNA' | 'EXTERNA';
  codigo: string;
  actividad: string;
  grupo: string;
  docente: string;
}

export interface RespuestaOcupacionSemanal {
  estado_horario: 'BORRADOR' | 'CERRADO' | 'SIN_GENERAR';
  salas: SalaDTO[];
  dias: { id_dia: number; nombre: string }[];
  bloques: { id_bloque: number; horaInicio: string; horaFin: string }[];
  docentes: DocenteCalendarioDTO[];
  ocupaciones: OcupacionCelda[];
}

@Injectable({
  providedIn: 'root',
})
export class HorarioCalendarioService {
  private apiUrl = `${environment.apiUrl}/horario/calendario`;

  constructor(private http: HttpClient) {}

  obtenerOcupacionSemanal(semestre: number, year: number): Observable<RespuestaOcupacionSemanal> {
    const params = new HttpParams()
      .set('semestre', semestre.toString())
      .set('year', year.toString());

    return this.http.get<RespuestaOcupacionSemanal>(`${this.apiUrl}/ocupacion-semanal`, {
      params,
      withCredentials: true,
    });
  }
}