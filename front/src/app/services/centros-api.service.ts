import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API = 'http://localhost:3000/api';

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

// ==== Payloads limpios para crear/actualizar ====
export interface CreateCentroPayload {
  nombre: string;
  tipo: 'PARTICULAR' | 'PARTICULAR_SUBVENCIONADO' | 'SLEP' | 'NO_CONVENCIONAL' | string;
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
    return this.http.get<PagedResult<CentroEducativoDTO>>(`${API}/centros`, { params: p });
  }

  getById(id: number): Observable<CentroEducativoDTO> {
    return this.http.get<CentroEducativoDTO>(`${API}/centros/${id}`);
  }

  // ========== CREATE ==========
  create(body: CreateCentroPayload) {
    const toNumberOrNull = (v: any): number | null =>
      (v == null || v === '' || isNaN(Number(v))) ? null : Number(v);

    const isValidEmail = (e?: string) =>
      !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

    const payload = {
      nombre: body.nombre,
      tipo: body.tipo,
      region: body.region,
      comuna: body.comuna,
      convenio: body.convenio ?? undefined, 
      direccion: body.direccion ?? undefined,
      telefono: toNumberOrNull(body.telefono), 
      correo: isValidEmail(body.correo) ? body.correo!.trim() : undefined,
      url_rrss: body.url_rrss ?? undefined,
      fecha_inicio_asociacion: body.fecha_inicio_asociacion ?? null, 
    };

    return this.http.post<CentroEducativoDTO>(`${API}/centros`, payload);
  }

  // ========== UPDATE ==========
  update(id: number, body: UpdateCentroPayload) {
    const toNumberOrNull = (v: any): number | null =>
      (v == null || v === '' || isNaN(Number(v))) ? null : Number(v);

    const isValidEmail = (e?: string) =>
      !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

    const payload: any = {};

    if (body.nombre !== undefined)  payload.nombre = body.nombre;
    if (body.tipo !== undefined)    payload.tipo = body.tipo;
    if (body.region !== undefined)  payload.region = body.region;
    if (body.comuna !== undefined)  payload.comuna = body.comuna;
    if (body.convenio !== undefined) payload.convenio = body.convenio ?? undefined;
    if (body.direccion !== undefined) payload.direccion = body.direccion ?? undefined;
    if (body.telefono !== undefined)  payload.telefono = toNumberOrNull(body.telefono);
    if (body.correo !== undefined)    payload.correo = isValidEmail(body.correo) ? body.correo!.trim() : undefined;
    if (body.url_rrss !== undefined)  payload.url_rrss = body.url_rrss ?? undefined;
    if (body.fecha_inicio_asociacion !== undefined)
      payload.fecha_inicio_asociacion = body.fecha_inicio_asociacion ?? null;

    return this.http.patch<CentroEducativoDTO>(`${API}/centros/${id}`, payload);
  }

  delete(id: number) {
    return this.http.delete<void>(`${API}/centros/${id}`);
  }
}
