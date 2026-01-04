import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API = `${environment.apiUrl}/reportes`;

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
  anio: number;
  semestre: 1 | 2;
  tipo: string | null;

  practicas: {
    totalPracticas: number;
    estudiantesUnicos: number;
    aprobadas: number;
    reprobadas: number;
    enCurso: number;
    porcentajes: {
      aprobadas: number;
      reprobadas: number;
      enCurso: number;
    };
    porcentajeAprobacionEvaluadas: number;
  };

  encuestasEstudiantes: {
    totalEncuestas: number;
    totalAlternativasRespondidas: number;
    porcentajeSatisfaccion: number;
  };

  encuestasColaboradores: {
    totalEncuestas: number;
    totalAlternativasRespondidas: number;
    porcentajeSatisfaccion: number;
  };

  generatedAt: string;
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

export interface ReportesHistoricoItem {
  periodo: string; 
  totalEstudiantes: number;
  centrosPorTipo: { tipo: string; total: number }[];
  supervisores: string[];
  mentores: string[];
}

export interface ReportesHistoricoResponse {
  fromYear: number;
  toYear: number;
  tipo: string | null;
  groupBy: 'semester' | 'year';
  series: ReportesHistoricoItem[];
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

  getSatisfaccion(params: {
    anio: number;
    semestre: 1 | 2;
    tipo?: string | null;
  }): Observable<ReporteSatisfaccion> {
    const q = new URLSearchParams({
      anio: String(params.anio),
      semestre: String(params.semestre),
    });

    if (params.tipo) q.append('tipo', params.tipo);

    return this.http.get<ReporteSatisfaccion>(`${API}/satisfaccion?${q.toString()}`);
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

  getHistorico(params: {
    fromYear: number;
    toYear: number;
    tipo?: string | null;
    groupBy: 'semester' | 'year';
  }): Observable<ReportesHistoricoResponse> {
    const q = new URLSearchParams({
      fromYear: String(params.fromYear),
      toYear: String(params.toYear),
      groupBy: params.groupBy,
    });

    if (params.tipo) q.append('tipo', params.tipo);

    return this.http.get<ReportesHistoricoResponse>(`${API}/historico?${q.toString()}`);
  }


}
