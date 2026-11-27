import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SalaDTO } from './salas-api.service';

export type OrigenAsignatura = 'PROPIA' | 'EXTERNA' | 'INTERNA';
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
  year?: number;
  anio?: number;
  version?: string;
  codigo_carrera?: string;
  id_carrera?: string | number;
  carrera?: CarreraDTO;
}

export interface CarreraDTO {
  id_carrera: string | number;
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
  origen?: string;
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
  id_asignatura?: string | number;
  bloques_horarios: BloqueHorarioDTO[];
}

export interface AsignaturaDTO {
  id_asignatura?: string | number;
  codigo: string;
  nombre: string;
  catedraSemanal?: number;
  tallerSemanal?: number;
  labSemanal?: number;
  semestre: number;
  cupo: number;
  bloques_semanales: number;
  origen: string;
  id_plan: number;
  plan?: PlanDTO;
  cursos?: CursoDTO[];
}

export interface CreateAsignaturaPayload {
  codigo: string;
  nombre: string;
  id_plan: number;
  semestre: number;
  bloques_semanales?: number;
  catedraSemanal?: number;
  tallerSemanal?: number;
  labSemanal?: number;
  cupo: number;
  origen: string;
  bloques_externos?: BloqueExternoPayload[];
}

export type UpdateAsignaturaPayload = Partial<CreateAsignaturaPayload>;

// ---------- BLOQUES PROTEGIDOS (DIS-F01) ----------
export type AlcanceBloqueProtegidoUI =
  | 'UNIVERSIDAD'
  | 'FACULTAD'
  | 'CARRERA'
  | 'ESTUDIANTES'
  | 'PRACTICA_PREPRACTICA'
  | 'ACADEMICOS'
  | 'ACADEMICO_INDIVIDUAL';

export interface BloqueProtegidoDTO {
  id_bloque_protegido: number;
  ids?: number[];
  nombre: string;
  alcance: AlcanceBloqueProtegidoUI;
  dia: DiaSemana;
  id_dia?: number;
  bloque_inicio: number;
  bloque_fin: number;
  bloques?: number[];
  hora_inicio: string;
  hora_fin: string;
  codigo_carrera?: string | null;
  semestre?: number | null;
  contrato?: string | null;
  id_usuario?: number | null;
  carrera?: { codigo: string; nombre: string } | null;
  profesor?: {
    id_usuario: number;
    contrato: string;
    usuario?: { id: number; nombre: string; email: string } | null;
  } | null;
}

export interface CreateBloqueProtegidoPayload {
  nombre: string;
  alcance: AlcanceBloqueProtegidoUI;
  dias?: DiaSemana[];
  dia?: DiaSemana;
  bloque_inicio: number;
  bloque_fin: number;
  codigo_carrera?: string;
  semestre?: number;
  contrato?: string;
  id_usuario?: number;
}

export interface ProfesorItemDTO {
  id_usuario: number;
  contrato: string;
  usuario: {
    id: number;
    nombre: string;
    email: string;
  };
}

// ---------- DISPONIBILIDAD DOCENTE (DIS-F02) ----------
export interface BloqueDisponibleDTO {
  dia: DiaSemana;
  bloque: number;
}

export interface MiDisponibilidadDTO {
  profesor: {
    id_usuario: number;
    nombre: string;
    email: string;
    contrato: 'PLANTA' | 'HORAS';
  };
  habilitado: boolean;
  contratos_habilitados: string[];
  bloques: BloqueDisponibleDTO[];
}

// ---------- PROPUESTA DE HORARIO (HU Generar propuesta) ----------
// Lo que se asigna son CURSOS (no asignaturas). La propuesta es por plan y
// período (1 = primer semestre: niveles impares; 2 = segundo: niveles pares).
// Estados en el back: BORRADOR (generado, sin guardar) y PROPUESTA (guardada).
export type TipoCurso = 'CATEDRA' | 'TALLER' | 'LABORATORIO';

export type EstadoCursoPropuesta = 'ASIGNADO' | 'PARCIAL' | 'NO_ASIGNADO';

export type EstadoPropuesta = 'BORRADOR' | 'PROPUESTA';

// Motivos por los que el algoritmo no pudo ubicar (todos o parte de) los bloques de un curso
export type MotivoNoAsignado =
  | 'SIN_BLOQUES_LIBRES' // no quedan pares de bloques libres en el nivel
  | 'DOCENTE_SIN_DISPONIBILIDAD' // docente por horas sin disponibilidad compatible (sin declarar = 0 bloques)
  | 'DOCENTE_OCUPADO' // el docente ya tiene otros cursos en los bloques en que está disponible
  | 'SIN_SALA_CON_CAPACIDAD'; // hay bloques posibles, pero ninguna sala libre con capacidad

// Advertencias: no detienen ni alteran la generación, solo se informan
export type AdvertenciaCursoPropuesta =
  | 'SIN_DOCENTE' // curso sin docente asignado: se asume siempre disponible
  | 'SIN_INSCRITOS'; // curso con 0 inscritos: no se valida la capacidad de la sala

export interface DocentePropuestaDTO {
  id_usuario: number;
  nombre: string;
  contrato: 'PLANTA' | 'HORAS';
}

// Una sesión = bloques consecutivos del mismo día (normalmente un par: 1-2, 3-4, 5-6...)
export interface SesionPropuestaDTO {
  dia: DiaSemana;
  bloque_inicio: number;
  bloque_fin: number;
  id_sala: number;
  sala_nombre: string;
}

export interface CursoPropuestaDTO {
  id_curso: number;
  tipo: TipoCurso;
  grupo: string;
  codigo_asignatura: string;
  nombre_asignatura: string;
  nivel: number;
  bloques_requeridos: number;
  inscritos: number;
  docentes: DocentePropuestaDTO[];
  sesiones: SesionPropuestaDTO[];
  estado: EstadoCursoPropuesta;
  motivo: MotivoNoAsignado | null; // solo justo después de generar
  detalle_motivo: string | null;
  advertencias: AdvertenciaCursoPropuesta[];
}

export interface ResumenPropuestaDTO {
  total_cursos: number;
  asignados: number;
  parciales: number;
  no_asignados: number;
  sin_docente: number;
  sin_inscritos: number;
}

export interface AsignaturaSinCursosDTO {
  codigo: string;
  nombre: string;
  nivel: number;
}

export interface PropuestaHorarioDTO {
  id_plan: number;
  codigo_carrera: string;
  periodo: number;
  year: number;
  estado: EstadoPropuesta | null; // null: no hay borrador ni propuesta guardada
  con_motivos: boolean; // los motivos no se guardan: solo vienen al generar
  niveles: number[]; // niveles del plan que se dictan en el período
  cursos: CursoPropuestaDTO[];
  resumen: ResumenPropuestaDTO;
  asignaturas_sin_cursos: AsignaturaSinCursosDTO[];
}

export interface PlanPeriodoPayload {
  id_plan: number;
  periodo: number;
}

export const TIPO_CURSO_LABEL: Record<TipoCurso, string> = {
  CATEDRA: 'Cátedra',
  TALLER: 'Taller',
  LABORATORIO: 'Laboratorio',
};

export const MOTIVO_NO_ASIGNADO_LABEL: Record<MotivoNoAsignado, string> = {
  SIN_BLOQUES_LIBRES: 'Sin bloques libres',
  DOCENTE_SIN_DISPONIBILIDAD: 'Docente sin disponibilidad',
  DOCENTE_OCUPADO: 'Docente ocupado',
  SIN_SALA_CON_CAPACIDAD: 'Sin sala con capacidad',
};

export const ADVERTENCIA_LABEL: Record<AdvertenciaCursoPropuesta, string> = {
  SIN_DOCENTE: 'Sin docente',
  SIN_INSCRITOS: 'Sin inscritos',
};

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
    origen?: string;
    id_carrera?: string | number;
    codigo_carrera?: string;
    id_plan?: number;
    semestre?: number;
  }): Observable<AsignaturaDTO[]> {
    let p = new HttpParams();
    if (params?.origen) p = p.set('origen', params.origen);
    if (params?.id_carrera != null)
      p = p.set('id_carrera', String(params.id_carrera));
    if (params?.codigo_carrera != null)
      p = p.set('codigo_carrera', params.codigo_carrera);
    if (params?.id_plan != null) p = p.set('id_plan', String(params.id_plan));
    if (params?.semestre != null)
      p = p.set('semestre', String(params.semestre));

    return this.http.get<AsignaturaDTO[]>(`${this.baseUrl}/asignaturas`, {
      params: p,
    });
  }

  getAsignatura(codigo: string | number): Observable<AsignaturaDTO> {
    return this.http.get<AsignaturaDTO>(
      `${this.baseUrl}/asignaturas/${codigo}`,
    );
  }

  createAsignatura(
    payload: CreateAsignaturaPayload,
  ): Observable<AsignaturaDTO> {
    return this.http.post<AsignaturaDTO>(
      `${this.baseUrl}/asignaturas`,
      payload,
    );
  }

  updateAsignatura(
    codigo: string | number,
    payload: UpdateAsignaturaPayload,
  ): Observable<AsignaturaDTO> {
    return this.http.patch<AsignaturaDTO>(
      `${this.baseUrl}/asignaturas/${codigo}`,
      payload,
    );
  }

  deleteAsignatura(codigo: string | number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/asignaturas/${codigo}`);
  }

  getBloques(params?: {
    dia?: DiaSemana;
    id_sala?: number;
    origen?: string;
  }): Observable<BloqueHorarioDTO[]> {
    let p = new HttpParams();
    if (params?.dia) p = p.set('dia', params.dia);
    if (params?.id_sala != null) p = p.set('id_sala', String(params.id_sala));
    if (params?.origen) p = p.set('origen', params.origen);

    return this.http.get<BloqueHorarioDTO[]>(`${this.baseUrl}/bloques`, {
      params: p,
    });
  }

  getSalas(soloActivas = true): Observable<SalaDTO[]> {
    const params = new HttpParams().set('soloActivas', String(soloActivas));
    return this.http.get<SalaDTO[]>(`${this.baseUrl}/salas`, { params });
  }

  // ---------- Bloques Protegidos API (DIS-F01) ----------
  getBloquesProtegidos(params?: {
    alcance?: string;
    dia?: string;
    codigo_carrera?: string;
    semestre?: number;
    id_usuario?: number;
  }): Observable<BloqueProtegidoDTO[]> {
    let p = new HttpParams();
    if (params?.alcance) p = p.set('alcance', params.alcance);
    if (params?.dia) p = p.set('dia', params.dia);
    if (params?.codigo_carrera)
      p = p.set('codigo_carrera', params.codigo_carrera);
    if (params?.semestre != null)
      p = p.set('semestre', String(params.semestre));
    if (params?.id_usuario != null)
      p = p.set('id_usuario', String(params.id_usuario));

    return this.http.get<BloqueProtegidoDTO[]>(
      `${this.baseUrl}/bloques-protegidos`,
      { params: p },
    );
  }

  getBloquesProtegidosAplicables(params: {
    codigo_carrera?: string;
    semestre?: number;
    id_usuario?: number;
  }): Observable<BloqueProtegidoDTO[]> {
    let p = new HttpParams();
    if (params.codigo_carrera)
      p = p.set('codigo_carrera', params.codigo_carrera);
    if (params.semestre != null)
      p = p.set('semestre', String(params.semestre));
    if (params.id_usuario != null)
      p = p.set('id_usuario', String(params.id_usuario));

    return this.http.get<BloqueProtegidoDTO[]>(
      `${this.baseUrl}/bloques-protegidos/aplicables`,
      { params: p },
    );
  }

  getProfesoresBloquesProtegidos(): Observable<ProfesorItemDTO[]> {
    return this.http.get<ProfesorItemDTO[]>(
      `${this.baseUrl}/bloques-protegidos/profesores`,
    );
  }

  createBloqueProtegido(
    payload: CreateBloqueProtegidoPayload,
  ): Observable<{ mensaje: string; total_creados?: number }> {
    return this.http.post<{ mensaje: string; total_creados?: number }>(
      `${this.baseUrl}/bloques-protegidos`,
      payload,
    );
  }

  updateBloqueProtegido(
    id: number,
    payload: Partial<CreateBloqueProtegidoPayload>,
  ): Observable<BloqueProtegidoDTO> {
    return this.http.patch<BloqueProtegidoDTO>(
      `${this.baseUrl}/bloques-protegidos/${id}`,
      payload,
    );
  }

  deleteBloqueProtegido(
    id: number,
    grupo = false,
  ): Observable<{ mensaje: string; eliminados?: number }> {
    const params = new HttpParams().set('grupo', String(grupo));
    return this.http.delete<{ mensaje: string; eliminados?: number }>(
      `${this.baseUrl}/bloques-protegidos/${id}`,
      { params },
    );
  }

  // ---------- DISPONIBILIDAD DOCENTE (DIS-F02) ----------
  // Siempre sobre el docente autenticado: el back toma el id desde la sesión
  getMiDisponibilidad(): Observable<MiDisponibilidadDTO> {
    return this.http.get<MiDisponibilidadDTO>(
      `${this.baseUrl}/disponibilidad/mia`,
    );
  }

  guardarMiDisponibilidad(
    bloques: BloqueDisponibleDTO[],
  ): Observable<MiDisponibilidadDTO> {
    return this.http.put<MiDisponibilidadDTO>(
      `${this.baseUrl}/disponibilidad/mia`,
      { bloques },
      {
        // El PUT exige CsrfGuard: mismo token que guarda AuthService al iniciar sesión
        headers: new HttpHeaders({
          'X-CSRF-Token': localStorage.getItem('app.token') ?? '',
        }),
      },
    );
  }

  // ---------- PROPUESTA DE HORARIO ----------
  private csrfHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-CSRF-Token': localStorage.getItem('app.token') ?? '',
    });
  }

  private planPeriodoParams(p: PlanPeriodoPayload): HttpParams {
    return new HttpParams()
      .set('id_plan', String(p.id_plan))
      .set('periodo', String(p.periodo));
  }

  // Borrador si existe; si no, la propuesta guardada (estado null si no hay nada)
  getPropuesta(p: PlanPeriodoPayload): Observable<PropuestaHorarioDTO> {
    return this.http.get<PropuestaHorarioDTO>(`${this.baseUrl}/propuestas`, {
      params: this.planPeriodoParams(p),
    });
  }

  // Genera y guarda el resultado como BORRADOR (reemplaza el anterior)
  generarPropuesta(p: PlanPeriodoPayload): Observable<PropuestaHorarioDTO> {
    return this.http.post<PropuestaHorarioDTO>(
      `${this.baseUrl}/propuestas/generar`,
      p,
      { headers: this.csrfHeaders() },
    );
  }

  // El borrador pasa a PROPUESTA (reemplaza la propuesta guardada anterior)
  guardarPropuesta(p: PlanPeriodoPayload): Observable<PropuestaHorarioDTO> {
    return this.http.post<PropuestaHorarioDTO>(
      `${this.baseUrl}/propuestas/guardar`,
      p,
      { headers: this.csrfHeaders() },
    );
  }

  // Elimina el borrador; la propuesta guardada no se toca
  descartarBorrador(p: PlanPeriodoPayload): Observable<PropuestaHorarioDTO> {
    return this.http.delete<PropuestaHorarioDTO>(`${this.baseUrl}/propuestas`, {
      params: this.planPeriodoParams(p),
      headers: this.csrfHeaders(),
    });
  }
}
