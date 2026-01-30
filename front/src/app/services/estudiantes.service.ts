import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type EstadoPractica = 'EN_CURSO' | 'APROBADO' | 'REPROBADO';
export type TipoPostgrado = 'DIPLOMADO' | 'MAGISTER' | 'DOCTORADO' | 'OTRO';
export type EstadoPostgrado = 'EN_CURSO' | 'FINALIZADO';

const API_URL = `${environment.apiUrl}/estudiantes`;


export interface UltimaPractica {
  fecha_inicio: string;
  fecha_termino?: string | null;
  tipo?: string | null;
}

export interface EstudianteResumen {
  rut: string;
  nombre: string;
  plan?: string | null;
  email?: string | null;
  fono?: number | null;
  egresado?: boolean | null;
  estadoPractica?: EstadoPractica | null;
  ultimaPractica?: UltimaPractica | null;
}

export interface PracticaDetalle {
  id: number;
  estado: EstadoPractica;
  fecha_inicio: string;
  fecha_termino?: string | null;
  tipo?: string | null;
  centro?: {
    id: number;
    nombre: string;
    tipo?: string | null;
    region?: string | null;
    comuna?: string | null;
  } | null;
  practicaColaboradores?: { colaborador: { id: number; nombre: string; correo?: string | null } }[];
  practicaTutores?: { tutor: { id: number; nombre: string; correo?: string | null; telefono?: number | null }; rol: string }[];
}

export interface Actividad {
  id: number;
  nombre_actividad: string;
  mes: string;
  estudiantes?: string | null;
  terceros_asistieron?: boolean | null;
  fecha: string;
  horario?: string | null;
  lugar?: string | null;
  archivo_adjunto?: string | null;
}

export interface EmpleabilidadDetalle {
  lugarTrabajo: string;
  sector: string;
  sectorOtro?: string | null;
  cargo: string;
  cargoOtro?: string | null;
  situacionLaboral?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EstudianteDetalle extends EstudianteResumen {
  genero?: string | null;
  anio_nacimiento?: string | null;
  anio_ingreso?: number | null;
  direccion?: string | null;
  sistema_ingreso?: string | null;
  numero_inscripciones?: number | null;
  avance?: number | null;
  puntaje_ponderado?: number | null;
  puntaje_psu?: number | null;
  promedio?: number | null;
  practicas: PracticaDetalle[];
  actividades: Actividad[];
  empleabilidad?: Empleabilidad | null;
  egresadoFicha?: EgresadoFicha | null;
}

export interface EmpleabilidadPayload {
  lugarTrabajo: string;
  sector: string;
  sectorOtro?: string | null;
  cargo: string;
  cargoOtro?: string | null;
  situacionLaboral?: string | null;
  direccion?: string | null;
  email?: string | null;
  fono?: number | null;
}

export interface EstudianteQuery {
  nombre?: string;
  rut?: string;
  carrera?: string;
  estadoPractica?: EstadoPractica;
  tipoPractica?: string;
  semestre?: number;
  anio?: number;
  anioIngreso?: number;
  egresado?: boolean;
  page?: number;
  limit?: number;
}

export interface EgresadoPostgrado {
  id: number;
  tipo: 'DIPLOMADO' | 'MAGISTER' | 'DOCTORADO' | 'OTRO';
  institucion: string;
  anioInicio?: number | null;
  anioTermino?: number | null;
  estado: 'EN_CURSO' | 'FINALIZADO';
  createdAt?: string;
  updatedAt?: string;
}

export interface EgresadoFicha {
  id: number;
  estudianteRut: string;

  nacionalidad?: string | null;
  anioEgreso?: number | null;
  notaTitulacion?: number | null;
  fechaDefensa?: string | null;

  celular?: string | null;
  email?: string | null;
  direccion?: string | null;
  region?: string | null;
  ciudad?: string | null;

  postgrados?: EgresadoPostgrado[];
}

export interface Empleabilidad {
  id: number;
  estudianteRut: string;
  lugarTrabajo: string;
  sector: string;
  sectorOtro?: string | null;
  cargo: string;
  cargoOtro?: string | null;
  createdAt?: string;
  updatedAt?: string;
}


export interface UpsertEgresadoFichaPayload {
  nacionalidad?: string | null;
  anioEgreso?: number | null;
  notaTitulacion?: number | null;
  fechaDefensa?: string | null;

  celular?: string | null;
  email?: string | null;
  direccion?: string | null;
  region?: string | null;
  ciudad?: string | null;
}

export interface PostgradoPayload {
  tipo: TipoPostgrado;
  institucion: string;
  anioInicio?: number | null;
  anioTermino?: number | null;
  estado: EstadoPostgrado;
}

export interface ImportSummary {
  inserted: number;
  updated: number;
  total: number;
  errors: { row: number; rut?: string; message: string }[];
}

@Injectable({ providedIn: 'root' })
export class EstudiantesService {
  constructor(private http: HttpClient) {}

  listar(params?: EstudianteQuery): Observable<EstudianteResumen[]> {
    let httpParams = new HttpParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<EstudianteResumen[]>(API_URL, { params: httpParams });
  }

  obtenerDetalle(rut: string): Observable<EstudianteDetalle> {
    return this.http.get<EstudianteDetalle>(`${API_URL}/${rut}`);
  }

  importarDesdeXlsx(file: File): Observable<ImportSummary> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportSummary>(`${API_URL}/import`, formData);
  }

  actualizarEgresado(rut: string, egresado: boolean): Observable<EstudianteResumen> {
    return this.http.patch<EstudianteResumen>(`${API_URL}/${rut}/egresado`, { egresado });
  }

  guardarEmpleabilidad(rut: string, payload: EmpleabilidadPayload): Observable<any> {
    return this.http.put(`${API_URL}/${rut}/empleabilidad`, payload);
  }
  
  upsertEgresadoFicha(rut: string, payload: UpsertEgresadoFichaPayload): Observable<any> {
    return this.http.put(`${API_URL}/${rut}/egresado-ficha`, payload);
  }

  crearPostgrado(rut: string, payload: PostgradoPayload): Observable<any> {
    return this.http.post(`${API_URL}/${rut}/postgrados`, payload);
  }

  actualizarPostgrado(id: number, payload: Partial<PostgradoPayload>): Observable<any> {
    return this.http.put(`${API_URL}/postgrados/${id}`, payload);
  }

  eliminarPostgrado(id: number): Observable<any> {
    return this.http.delete(`${API_URL}/postgrados/${id}`);
  }
}
