import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EvidenciasFiles {
  asistencia?: File[];
  documentos?: File[];
  fotos?: File[];
}

export interface ActividadOption {
  id: number;
  nombre: string;
  fechaInicio?: string;
  tipoActividad?: string;
}

@Injectable({ providedIn: 'root' })
export class ActividadVinculacionService {
  private baseUrl = `${environment.apiUrl}/actividad-vinculacion`;

  constructor(private http: HttpClient) {}

  listarParaSelect(): Observable<ActividadOption[]> {
    return this.http.get<ActividadOption[]>(`${this.baseUrl}/listado`);
  }
}

export interface DifusionItem {
  medio: string;
  url?: string;
}

export interface GuardarActividadPmRequest {
  payload: any;
  unidades: any[];
  responsables: any[];
  equipoTrabajo: any[];
  financiamientos: any[];
  centrosCosto: any[];
  difusiones: DifusionItem[];
  instituciones: any[];
  estudiantes?: any[];
  files?: EvidenciasFiles;
}

@Injectable({ providedIn: 'root' })
export class ActividadesPmService {
  private readonly baseUrl = `${environment.apiUrl}/actividades-pm`;

  constructor(private http: HttpClient) {}

  crear(req: GuardarActividadPmRequest): Observable<any> {
    const formData = this.buildFormData(req);
    return this.http.post(this.baseUrl, formData);
  }

  actualizar(id: number | string, req: GuardarActividadPmRequest): Observable<any> {
    const formData = this.buildFormData(req);
    return this.http.put(`${this.baseUrl}/${id}`, formData);
  }

  listar(filters?: { anio?: number; tipo?: string; q?: string; fechaInicio?: string; fechaTermino?: string }): Observable<any[]> {
    let params = new HttpParams();
    if (filters?.anio) params = params.set('anio', String(filters.anio));
    if (filters?.tipo) params = params.set('tipo', filters.tipo);
    if (filters?.q) params = params.set('q', filters.q);
    if (filters?.fechaInicio) params = params.set('fechaInicio', filters.fechaInicio);
    if (filters?.fechaTermino) params = params.set('fechaTermino', filters.fechaTermino);

    return this.http.get<any[]>(this.baseUrl, { params });
  }

  obtener(id: number | string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

  regenerarResumen(id: number | string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${id}/resumen-ia`, {});
  }

  obtenerUnidadPorCodigo(codigo: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/unidades/${encodeURIComponent(codigo)}`);
  }

  obtenerResponsablePorRut(rut: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/responsables/${encodeURIComponent(rut)}`);
  }

  obtenerEquipoTrabajoPorRut(rut: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/equipo-trabajo/${encodeURIComponent(rut)}`);
  }

  private buildFormData(req: GuardarActividadPmRequest): FormData {
    const fd = new FormData();

    const data = {
      ...req.payload,
      unidades: req.unidades,
      responsables: req.responsables,
      equipoTrabajo: req.equipoTrabajo,
      financiamientos: req.financiamientos,
      centrosCosto: req.centrosCosto,
      difusiones: req.difusiones,
      instituciones: req.instituciones,
      estudiantes: req.estudiantes ?? [],
    };

    fd.append('data', JSON.stringify(data));

    if (req.files?.asistencia?.length) {
      for (const file of req.files.asistencia) {
        fd.append('asistencia', file, file.name);
      }
    }
    if (req.files?.documentos?.length) {
      for (const file of req.files.documentos) {
        fd.append('documentos', file, file.name);
      }
    }
    if (req.files?.fotos?.length) {
      for (const file of req.files.fotos) {
        fd.append('fotos', file, file.name);
      }
    }

    return fd;
  }

  eliminar(id: number | string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

}
