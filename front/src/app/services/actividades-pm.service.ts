import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EvidenciasFiles {
  asistencia?: File | null;
  documentos?: File | null;
  fotos?: File | null;
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

  listar(filters?: { anio?: number; tipo?: string; q?: string }): Observable<any[]> {
    let params = new HttpParams();
    if (filters?.anio) params = params.set('anio', String(filters.anio));
    if (filters?.tipo) params = params.set('tipo', filters.tipo);
    if (filters?.q) params = params.set('q', filters.q);

    return this.http.get<any[]>(this.baseUrl, { params });
  }

  obtener(id: number | string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
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

    if (req.files?.asistencia) {
      fd.append('asistencia', req.files.asistencia, req.files.asistencia.name);
    }
    if (req.files?.documentos) {
      fd.append('documentos', req.files.documentos, req.files.documentos.name);
    }
    if (req.files?.fotos) {
      fd.append('fotos', req.files.fotos, req.files.fotos.name);
    }

    return fd;
  }

  eliminar(id: number | string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

}
