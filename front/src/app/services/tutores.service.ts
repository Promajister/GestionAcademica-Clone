import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = `${environment.apiUrl}/tutores`;

export interface Tutor {
  id: number;
  rut: string;
  nombre: string;
  correo?: string;
  telefono?: number;
  cargo?: string;
  universidad_egreso?: string;
  direccion?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TutorResponse {
  items: Tutor[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface QueryTutorParams {
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: 'nombre' | 'createdAt';
  orderDir?: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root',
})
export class TutoresService {
  constructor(private http: HttpClient) {}

  listar(params?: QueryTutorParams): Observable<TutorResponse> {
    let httpParams = new HttpParams();

    if (params) {
      Object.keys(params).forEach((key) => {
        const value = params[key as keyof QueryTutorParams];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<TutorResponse>(API_URL, { params: httpParams });
  }

  obtenerPorId(id: number): Observable<Tutor> {
    return this.http.get<Tutor>(`${API_URL}/${id}`);
  }

  crear(tutor: Partial<Tutor>): Observable<Tutor> {
    return this.http.post<Tutor>(API_URL, tutor);
  }

  actualizar(id: number, tutor: Partial<Tutor>): Observable<Tutor> {
    return this.http.patch<Tutor>(`${API_URL}/${id}`, tutor);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`);
  }
}
