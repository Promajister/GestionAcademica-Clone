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
    colaboradoresUnicos: number;
    aprobadas: number;
    reprobadas: number;
    enCurso: number;
    porcentajes: {
      aprobadas: number;
      reprobadas: number;
      enCurso: number;
    };
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
    notaFinal?: number | null;

    anio?: number;       
    semestre?: number;   

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
  colaboradores: string[];
  supervisores: string[];
  talleristas: string[];
}

export interface ReportesHistoricoResponse {
  fromYear: number;
  toYear: number;
  tipo: string | null;
  groupBy: 'semester' | 'year';
  series: ReportesHistoricoItem[];
}

export interface EstudianteIndexItem {
  rut: string;
  nombre: string;
  plan?: string | null;
  centros: string[];
  supervisores: string[];
}

export interface EstudiantesIndexResponse {
  items: EstudianteIndexItem[];
  page: number;
  limit: number;
  total: number;
  pages: number;
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

  listarEstudiantes(params?: {
    search?: string;
    page?: number;
    limit?: number;
    orderBy?: 'nombre' | 'rut';
    orderDir?: 'asc' | 'desc';
  }): Observable<EstudiantesIndexResponse> {
    const q = new URLSearchParams();

    if (params?.search?.trim()) q.set('search', params.search.trim());
    q.set('page', String(params?.page ?? 1));
    q.set('limit', String(params?.limit ?? 10));
    q.set('orderBy', params?.orderBy ?? 'nombre');
    q.set('orderDir', params?.orderDir ?? 'asc');

    return this.http.get<EstudiantesIndexResponse>(`${API}/estudiantes?${q.toString()}`);
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

