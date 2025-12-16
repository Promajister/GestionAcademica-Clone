import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API = `${environment.apiUrl}/trabajadores`;

export interface Trabajador {
  id: number;
  rut: string;
  nombre: string;
  rol?: string | null;
  correo?: string | null;
  telefono?: number | null;
  centroId: number;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

@Injectable({ providedIn: 'root' })
export class TrabajadoresApiService {
  private http = inject(HttpClient);

  list(params?: {
    centroId?: number;
    rol?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Observable<PagedResult<Trabajador>> {

    let p = new HttpParams();
    if (params?.centroId) p = p.set('centroId', params.centroId);
    if (params?.rol)      p = p.set('rol', params.rol);
    if (params?.search)   p = p.set('search', params.search);
    if (params?.page)     p = p.set('page', params.page);
    if (params?.limit)    p = p.set('limit', params.limit);

    return this.http.get<PagedResult<Trabajador>>(API, { params: p });
  }

  create(body: {
    rut: string;
    nombre: string;
    rol?: string;
    correo?: string;
    telefono?: number | null;
    centroId: number;
  }) {
    return this.http.post<Trabajador>(API, body);
  }

  update(
    id: number,
    body: Partial<{
      rut: string;
      nombre: string;
      rol?: string;
      correo?: string;
      telefono?: number | null;
      centroId: number;
    }>
  ) {
    return this.http.patch<Trabajador>(`${API}/${id}`, body);
  }
}
