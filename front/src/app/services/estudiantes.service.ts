import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type EstadoPractica = 'EN_CURSO' | 'APROBADO' | 'REPROBADO';

const API_URL = 'http://localhost:3000/api/estudiante';

export interface UltimaPractica {
  fecha_inicio: string;
  fecha_termino?: string | null;
}

export interface EstudianteResumen {
  rut: string;
  nombre: string;
  plan?: string | null;
  email?: string | null;
  fono?: number | null;
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
  fecha: string;
  horario?: string | null;
  lugar?: string | null;
  archivo_adjunto?: string | null;
}

export interface EstudianteDetalle extends EstudianteResumen {
  genero?: string | null;
  anio_nacimiento?: string | null;
  anio_ingreso?: number | null;
  direccion?: string | null;
  sistema_ingreso?: string | null;
  numero_inscripciones?: number | null;
  practicas: PracticaDetalle[];
  actividades: Actividad[];
}

export interface EstudianteQuery {
  nombre?: string;
  carrera?: string;
  estadoPractica?: EstadoPractica;
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
}
