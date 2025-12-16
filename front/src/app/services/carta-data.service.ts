import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ApiCentro {
  id: number;
  nombre: string;
  comuna?: string | null;
  region?: string | null;
}

export interface ApiEstudiante {
  rut: string;
  nombre: string;
}

export interface ApiSupervisor {
  id: number;
  nombre: string;
  trato?: string | null;
  correo?: string | null;
}

export interface CreateCartaDto {
  tipoPractica: string;
  centroId: number;
  estudiantesIds: string[];
  supervisorId: number;
  periodoInicio: string; // yyyy-mm-dd
  periodoFin: string;
}

@Injectable({ providedIn: 'root' })
export class CartaDataService {

  // Base de la API, compatible con dev y prod
  private readonly API = environment.apiUrl;

  private readonly TIPOS_PRACTICA_DEFAULT = [
    'Apoyo a la Docencia I',
    'Apoyo a la Docencia II',
    'Apoyo a la Docencia III',
    'Práctica Profesional',
  ];

  constructor(private http: HttpClient) {}

  // -------------------------
  // CENTROS EDUCATIVOS
  // -------------------------
  /**
   * Obtiene centros educativos con paginación opcional
   * Devuelve solo el array "items" ya listo para el mat-select.
   */
  getCentros(search = '', page = 1, limit = 200): Observable<ApiCentro[]> {
    let params = new HttpParams()
      .set('page', page)
      .set('limit', limit);

    if (search) {
      params = params.set('search', search);
    }

    return new Observable<ApiCentro[]>(observer => {
      this.http.get<any>(`${this.API}/centros`, { params }).subscribe({
        next: (res) => {
          // Normaliza datos para que el componente no cambie nada
          observer.next(res.items ?? res);
        },
        error: (err) => observer.error(err)
      });
    });
  }

  // -------------------------
  // TIPOS DE PRÁCTICA
  // -------------------------
  getTiposPractica(): Observable<string[]> {
    return this.http
      .get<string[]>(`${this.API}/practicas/tipos`)
      .pipe(catchError(() => of(this.TIPOS_PRACTICA_DEFAULT)));
  }

  // -------------------------
  // ESTUDIANTES
  // -------------------------
  getEstudiantes(q = ''): Observable<ApiEstudiante[]> {
    const params = q ? new HttpParams().set('q', q) : undefined;
    return this.http.get<ApiEstudiante[]>(`${this.API}/estudiantes`, { params });
  }

  // -------------------------
  // SUPERVISORES
  // -------------------------
  getSupervisores(q = ''): Observable<ApiSupervisor[]> {
    const params = q ? new HttpParams().set('q', q) : undefined;
    return this.http.get<ApiSupervisor[]>(`${this.API}/supervisores`, { params });
  }

  // -------------------------
  // CARTAS
  // -------------------------
  crearCarta(dto: CreateCartaDto): Observable<any> {
    return this.http.post(`${this.API}/cartas`, dto);
  }

  generarPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.API}/cartas/${id}/pdf`, { responseType: 'blob' });
  }
}
