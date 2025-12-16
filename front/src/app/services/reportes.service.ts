import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API = 'http://localhost:3000/api/reportes';

export type EstadoPractica = 'EN_CURSO' | 'APROBADO' | 'REPROBADO';

export interface ReportesSummary {
  totals: {
    estudiantes: number;
    centros: number;
    tutores: number;
    practicas: {
      enCurso: number;
      aprobadas: number;
      reprobadas: number;
    };
  };

  charts: {
    practicasPorEstado: { label: string; value: number }[];
    practicasPorMes: { mes: string; value: number }[];
  };

  recientes: { id: number; nombre: string; fecha: string }[];

  vencimientos: {
    practicaId: number;
    estudiante: string;
    centro: string;
    fechaTermino: string;
    estado: EstadoPractica;
  }[];

  generatedAt: string;
}

export interface ReportesIndicadores {
  cobertura: {
    estudiantesEnPractica: number;
    practicasPorTipo: { tipo: string | null; total: number }[];
  };
  evaluacion: {
    totalPracticas: number;
    aprobadas: number;
    porcentajeAprobacion: number;
  };
}

export interface ReporteSatisfaccion {
  totalRespuestas: number;
  promedioSatisfaccion: number;
}

export interface ReporteEstudiante {
  rut: string;
  nombre: string;
  plan?: string | null;
  practicas: {
    id: number;
    tipo?: string | null;
    estado: EstadoPractica;
    fechaInicio: string;      
    fechaTermino?: string | null;
    centro?: string | null;
    tutores: string[];
  }[];
}

export interface EstudianteSearchItem {
  rut: string;
  nombre: string;
  plan?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private http = inject(HttpClient);

  getSummary(): Observable<ReportesSummary> {
    return this.http.get<ReportesSummary>(`${API}/summary`);
  }

  getIndicadores(): Observable<ReportesIndicadores> {
    return this.http.get<ReportesIndicadores>(`${API}/indicadores`);
  }

  getSatisfaccion(anio: number): Observable<ReporteSatisfaccion> {
    return this.http.get<ReporteSatisfaccion>(
      `${API}/satisfaccion?anio=${anio}`
    );
  }
  
  getReporteEstudiante(
    rut: string
    ): Observable<ReporteEstudiante | null> {
    return this.http.get<ReporteEstudiante | null>(
        `${API}/estudiante/${encodeURIComponent(rut)}`
    );
  }

  buscarEstudiantes(nombre: string): Observable<EstudianteSearchItem[]> {
    return this.http.get<EstudianteSearchItem[]>(
       `${API}/estudiantes/buscar?nombre=${encodeURIComponent(nombre)}`
      );
    }

}
