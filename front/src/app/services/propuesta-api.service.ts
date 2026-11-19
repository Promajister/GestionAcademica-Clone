import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type EstadoHorario = 'BORRADOR' | 'CERRADO';
export type OrigenActividad = 'INTERNA' | 'EXTERNA';

export type MotivoNoAsignada =
  | 'SIN_CARGA'
  | 'SIN_BLOQUES'
  | 'SIN_SALA'
  | 'SIN_DISPONIBILIDAD'
  | 'SIN_BLOQUE_LIBRE';

export interface NoAsignadaDTO {
  id_curso: number;
  codigo: string;
  nombre: string;
  grupo: string;
  nivel: number;
  motivo: MotivoNoAsignada;
  detalle: string;
  bloques_requeridos: number;
  bloques_asignados: number;
}

export interface ActividadDTO {
  id: string;
  origen: OrigenActividad;
  id_curso: number;
  codigo: string;
  nombre: string;
  grupo: string;
  nivel: number;
  id_plan: number | null;
  codigo_carrera: string | null;
  id_dia: number;
  dia: string;
  bloque_inicio: number;
  bloque_fin: number;
  id_sala: number | null;
  sala: string | null;
  sala_externa: string | null;
  docentes: { id_usuario: number; nombre: string }[];
}

export interface SalaPropuestaDTO {
  id_sala: number;
  nombre: string;
  tipo: 'CLASES' | 'REUNIONES';
  capacidad: number;
}

export interface PropuestaDTO {
  year: number;
  periodo: number;
  estado: EstadoHorario;
  generado_en: string | null;
  cerrado_en: string | null;
  no_asignadas: NoAsignadaDTO[];
  salas: SalaPropuestaDTO[];
  actividades: ActividadDTO[];
}

export interface ResultadoGeneracionDTO {
  mensaje: string;
  resumen: {
    cursos: number;
    cursos_completos: number;
    bloques_asignados: number;
    no_asignadas: number;
  };
}

// GEN-F01..F04: propuesta de horario del semestre
@Injectable({ providedIn: 'root' })
export class PropuestaApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/horario/propuesta`;

  // Las acciones que modifican exigen CsrfGuard: mismo token que guarda AuthService al iniciar sesión
  private csrf() {
    return {
      headers: new HttpHeaders({
        'X-CSRF-Token': localStorage.getItem('app.token') ?? '',
      }),
    };
  }

  obtener(year: number, periodo: number): Observable<PropuestaDTO> {
    const params = new HttpParams()
      .set('year', String(year))
      .set('periodo', String(periodo));
    return this.http.get<PropuestaDTO>(this.baseUrl, { params });
  }

  generar(year: number, periodo: number): Observable<ResultadoGeneracionDTO> {
    return this.http.post<ResultadoGeneracionDTO>(
      `${this.baseUrl}/generar`,
      { year, periodo },
      this.csrf(),
    );
  }
}
