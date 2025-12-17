import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

const API_URL = 'http://localhost:3000/practicas';

export interface Observacion {
  id: number;
  descripcion: string;
  fecha: string;
  createdAt: string;
  updatedAt: string;
  practicaId: number;
}

export interface CreateObservacionDto {
  descripcion: string;
}

export interface UpdateObservacionDto {
  descripcion: string;
}

@Injectable({
  providedIn: 'root'
})
export class ObservacionesService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private getHeaders(): HttpHeaders {
    const user = this.auth.getCurrentUser();
    const headers: { [key: string]: string } = {};
    
    if (user?.role) {
      headers['x-user-role'] = user.role;
    }
    
    return new HttpHeaders(headers);
  }

  listar(practicaId: number): Observable<Observacion[]> {
    return this.http.get<Observacion[]>(`${API_URL}/${practicaId}/observaciones`);
  }

  crear(practicaId: number, dto: CreateObservacionDto): Observable<{ message: string; data: Observacion }> {
    return this.http.post<{ message: string; data: Observacion }>(
      `${API_URL}/${practicaId}/observaciones`,
      dto,
      { headers: this.getHeaders() }
    );
  }

  actualizar(practicaId: number, id: number, dto: UpdateObservacionDto): Observable<{ message: string; data: Observacion }> {
    return this.http.patch<{ message: string; data: Observacion }>(
      `${API_URL}/${practicaId}/observaciones/${id}`,
      dto,
      { headers: this.getHeaders() }
    );
  }

  eliminar(practicaId: number, id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${API_URL}/${practicaId}/observaciones/${id}`,
      { headers: this.getHeaders() }
    );
  }
}

