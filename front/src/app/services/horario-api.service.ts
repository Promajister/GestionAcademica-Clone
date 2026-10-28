import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SalaDTO } from './salas-api.service';

export type OrigenAsignatura = 'PROPIA' | 'EXTERNA';
export type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES';

export interface BloqueGrillaDTO {
  numero: number;
  hora_inicio: string;
  hora_fin: string;
  jornada: 'MANANA' | 'TARDE';
}

export interface PlanDTO {
  id_plan: number;
  nombre: string;
  anio: number;
  vigente: boolean;
  id_carrera: number;
  carrera?: CarreraDTO;
}

export interface CarreraDTO {
  id_carrera: number;
  codigo: string;
  nombre: string;
  planes: PlanDTO[];
}

export interface BloqueExternoPayload {
  dia: DiaSemana;
  bloque_inicio: number;
  bloque_fin: number;
  id_sala?: number;
  sala_externa?: string;
}

export interface BloqueHorarioDTO {
  id_bloque_horario: number;
  dia: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
  bloque_numero: number;
  bloqueado: boolean;
  sala_externa?: string | null;
  id_curso: number;
  id_sala?: number | null;
  sala?: SalaDTO | null;
  origen?: OrigenAsignatura;
  curso?: {
    id_curso: number;
    nombre: string;
    tipo: string;
    asignatura?: AsignaturaDTO;
  };
}

export interface CursoDTO {
  id_curso: number;
  nombre: string;
  tipo: string;
  id_asignatura: number;
  bloques_horarios: BloqueHorarioDTO[];
}

export interface AsignaturaDTO {
  id_asignatura: number;
  codigo: string;
  nombre: string;
  semestre: number;
  cupo: number;
  bloques_semanales: number;
  origen: OrigenAsignatura;
  id_plan: number;
  plan?: PlanDTO;
  cursos?: CursoDTO[];
}

export interface CreateAsignaturaPayload {
  codigo: string;
  nombre: string;
  id_plan: number;
  semestre: number;
  bloques_semanales: number;
  cupo: number;
  origen: OrigenAsignatura;
  bloques_externos?: BloqueExternoPayload[];
}

export type UpdateAsignaturaPayload = Partial<CreateAsignaturaPayload>;

@Injectable({ providedIn: 'root' })
export class HorarioApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/horario`;

  getCarreras(): Observable<CarreraDTO[]> {
    return this.http.get<CarreraDTO[]>(`${this.baseUrl}/carreras`);
  }

  getGrilla(): Observable<BloqueGrillaDTO[]> {
    return this.http.get<BloqueGrillaDTO[]>(`${this.baseUrl}/grilla`);
  }

  getAsignaturas(params?: {
    origen?: OrigenAsignatura;
    id_carrera?: number;
    id_plan?: number;
    semestre?: number;
  }): Observable<AsignaturaDTO[]> {
    let p = new HttpParams();
    if (params?.origen) p = p.set('origen', params.origen);
    if (params?.id_carrera != null) p = p.set('id_carrera', String(params.id_carrera));
    if (params?.id_plan != null) p = p.set('id_plan', String(params.id_plan));
    if (params?.semestre != null) p = p.set('semestre', String(params.semestre));

    return this.http.get<AsignaturaDTO[]>(`${this.baseUrl}/asignaturas`, { params: p });
  }

  getAsignatura(id: number): Observable<AsignaturaDTO> {
    return this.http.get<AsignaturaDTO>(`${this.baseUrl}/asignaturas/${id}`);
  }

  createAsignatura(payload: CreateAsignaturaPayload): Observable<AsignaturaDTO> {
    return this.http.post<AsignaturaDTO>(`${this.baseUrl}/asignaturas`, payload);
  }

  updateAsignatura(id: number, payload: UpdateAsignaturaPayload): Observable<AsignaturaDTO> {
    return this.http.patch<AsignaturaDTO>(`${this.baseUrl}/asignaturas/${id}`, payload);
  }

  deleteAsignatura(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/asignaturas/${id}`);
  }

  getBloques(params?: {
    dia?: DiaSemana;
    id_sala?: number;
    origen?: OrigenAsignatura;
  }): Observable<BloqueHorarioDTO[]> {
    let p = new HttpParams();
    if (params?.dia) p = p.set('dia', params.dia);
    if (params?.id_sala != null) p = p.set('id_sala', String(params.id_sala));
    if (params?.origen) p = p.set('origen', params.origen);

    return this.http.get<BloqueHorarioDTO[]>(`${this.baseUrl}/bloques`, { params: p });
  }

  getSalas(soloActivas = true): Observable<SalaDTO[]> {
    const params = new HttpParams().set('soloActivas', String(soloActivas));
    return this.http.get<SalaDTO[]>(`${this.baseUrl}/salas`, { params });
  }
}
