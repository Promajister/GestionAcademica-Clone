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

export interface ActividadCruceDTO {
  id: string;
  codigo: string;
  grupo: string;
  nombre: string;
  origen: OrigenActividad;
  sala: string | null;
}

export interface CruceSalaDTO {
  id_sala: number;
  sala: string;
  id_dia: number;
  dia: string;
  bloque_inicio: number;
  bloque_fin: number;
  actividades: ActividadCruceDTO[];
  mensaje: string;
}

export interface CruceDocenteDTO {
  id_usuario: number;
  docente: string;
  id_dia: number;
  dia: string;
  bloque_inicio: number;
  bloque_fin: number;
  actividades: ActividadCruceDTO[];
  mensaje: string;
}

// Clase que quedó dentro de un bloque protegido que alcanza a sus estudiantes o docentes
export interface CruceProtegidoDTO {
  protegido: string;
  id_dia: number;
  dia: string;
  bloque_inicio: number;
  bloque_fin: number;
  actividades: ActividadCruceDTO[];
  mensaje: string;
}

export interface ValidacionDTO {
  cruces_sala: CruceSalaDTO[];
  cruces_docente: CruceDocenteDTO[];
  cruces_protegido: CruceProtegidoDTO[];
  puede_cerrar: boolean;
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
  validacion: ValidacionDTO;
  movimientos: number;
}

// GEN-F02: clase que se mueve y dónde se suelta
export interface MoverPayload {
  year: number;
  periodo: number;
  origen: OrigenActividad;
  id_curso: number;
  id_dia: number;
  bloque_inicio: number;
  bloque_fin: number;
  id_sala: number | null;
  hacia_dia: number;
  hacia_bloque: number;
  hacia_sala?: number;
}

export interface ResultadoMovimientoDTO {
  mensaje: string;
  validacion: ValidacionDTO;
  movimientos: number;
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

  // GEN-F02: el cambio queda guardado al soltar y el back revalida el horario completo
  mover(payload: MoverPayload): Observable<ResultadoMovimientoDTO> {
    return this.http.patch<ResultadoMovimientoDTO>(
      `${this.baseUrl}/mover`,
      payload,
      this.csrf(),
    );
  }

  deshacer(year: number, periodo: number): Observable<ResultadoMovimientoDTO> {
    return this.http.post<ResultadoMovimientoDTO>(
      `${this.baseUrl}/deshacer`,
      { year, periodo },
      this.csrf(),
    );
  }

  // GEN-F03: se rechaza (409) mientras existan cruces sin resolver
  cerrar(year: number, periodo: number): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${this.baseUrl}/cerrar`,
      { year, periodo },
      this.csrf(),
    );
  }

  reabrir(year: number, periodo: number): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${this.baseUrl}/reabrir`,
      { year, periodo },
      this.csrf(),
    );
  }
}
