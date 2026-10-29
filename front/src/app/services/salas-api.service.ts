import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TipoSala = 'CLASES' | 'REUNIONES';

export interface SalaDTO {
  id_sala: number;
  codigo?: string;
  nombre: string;
  capacidad: number;
  tipo: TipoSala;
  activo: boolean;
  _count?: {
    horarios?: number;
    horariosExternos?: number;
    ocupacionesPuntuales?: number;
    bloques_horarios?: number;
    ocupaciones?: number;
  };
}

export interface CreateSalaPayload {
  nombre: string;
  tipo: TipoSala;
  capacidad?: number;
  activo?: boolean;
}

export type UpdateSalaPayload = Partial<CreateSalaPayload>;

export interface DeleteSalaResponse {
  accion: 'DESACTIVADA' | 'ELIMINADA';
  mensaje: string;
  sala?: SalaDTO;
}

@Injectable({ providedIn: 'root' })
export class SalasApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/horario/salas`;

  listar(soloActivas?: boolean): Observable<SalaDTO[]> {
    let params = new HttpParams();
    if (soloActivas !== undefined) {
      params = params.set('soloActivas', String(soloActivas));
    }
    return this.http.get<SalaDTO[]>(this.baseUrl, { params });
  }

  obtener(id: number): Observable<SalaDTO> {
    return this.http.get<SalaDTO>(`${this.baseUrl}/${id}`);
  }

  crear(payload: CreateSalaPayload): Observable<SalaDTO> {
    return this.http.post<SalaDTO>(this.baseUrl, payload);
  }

  actualizar(id: number, payload: UpdateSalaPayload): Observable<SalaDTO> {
    return this.http.patch<SalaDTO>(`${this.baseUrl}/${id}`, payload);
  }

  eliminar(id: number): Observable<DeleteSalaResponse> {
    return this.http.delete<DeleteSalaResponse>(`${this.baseUrl}/${id}`);
  }
}
