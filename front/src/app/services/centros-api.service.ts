import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API = `${environment.apiUrl}/centros`;

export interface TrabajadorDTO {
  id: number;
  rut: string;
  nombre: string;
  rol?: string | null;
  correo?: string | null;
  telefono?: number | null;
  centroId?: number;
}

export interface CentroEducativoDTO {
  id: number;
  nombre: string;
  tipo: 'PARTICULAR' | 'PARTICULAR_SUBVENCIONADO' | 'SLEP' | 'NO_CONVENCIONAL' | string;
  region: string;
  comuna: string;
  convenio?: string | null;
  direccion?: string | null;
  telefono?: number | null;          
  correo?: string | null;
  url_rrss?: string | null;
  fecha_inicio_asociacion?: string | null; 
  trabajadores?: TrabajadorDTO[];
}

export interface PagedResult<T> {
  items: T[]; page: number; limit: number; total: number; pages: number;
}

export interface CreateCentroPayload {
  nombre: string;
  tipo: string;
  region: string;
  comuna: string;
  convenio?: string;
  direccion?: string;
  telefono?: number | string | null;
  correo?: string;
  url_rrss?: string;
  fecha_inicio_asociacion?: string | null;
}

export type UpdateCentroPayload = Partial<CreateCentroPayload>;

@Injectable({ providedIn: 'root' })
export class CentrosApiService {
  private http = inject(HttpClient);

  list(params?: {
    page?: number; limit?: number; search?: string; tipo?: string;
    orderBy?: string; orderDir?: 'asc' | 'desc';
  }): Observable<PagedResult<CentroEducativoDTO>> {
    let p = new HttpParams();
    if (params?.page != null)  p = p.set('page', params.page);
    if (params?.limit != null) p = p.set('limit', params.limit);
    if (params?.search)        p = p.set('search', params.search);
    if (params?.tipo)          p = p.set('tipo', params.tipo);
    if (params?.orderBy)       p = p.set('orderBy', params.orderBy);
    if (params?.orderDir)      p = p.set('orderDir', params.orderDir);
    
    return this.http.get<PagedResult<CentroEducativoDTO>>(API, { params: p });
  }

  getById(id: number): Observable<CentroEducativoDTO> {
    return this.http.get<CentroEducativoDTO>(`${API}/${id}`);
  }

  create(body: CreateCentroPayload) {
    return this.http.post<CentroEducativoDTO>(API, body);
  }

  update(id: number, body: UpdateCentroPayload) {
    return this.http.patch<CentroEducativoDTO>(`${API}/${id}`, body);
  }

  delete(id: number) {
    return this.http.delete<void>(`${API}/${id}`);
  }
}
