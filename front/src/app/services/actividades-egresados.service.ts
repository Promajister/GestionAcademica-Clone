import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Actividad,
  ActividadResponse,
  QueryActividadParams,
} from './actividades-estudiantes.service';

const API_URL = `${environment.apiUrl}/actividades-egresados`;
const API_BASE_URL = environment.apiUrl.replace(/\/api$/, '');

type ActividadEgresadosResponse = Omit<ActividadResponse, 'items'> & {
  items: any[];
};

@Injectable({
  providedIn: 'root',
})
export class ActividadesEgresadosService {
  constructor(private http: HttpClient) {}

  private formatearFechaLocal(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const day = fecha.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private mapActividad(raw: any): Actividad {
    const egresados = Array.isArray(raw?.egresados)
      ? raw.egresados
          .map((item: any) => item?.estudiante ?? item)
          .map((e: any) => {
            const rut = typeof e?.rut === 'string' ? e.rut : '';
            const nombre = typeof e?.nombre === 'string' ? e.nombre : '';
            return rut ? `${nombre || 'Egresado'} (${rut})` : '';
          })
          .filter(Boolean)
      : [];

    const terceros = Array.isArray(raw?.terceros)
      ? raw.terceros
          .map((item: any) => item?.tercero ?? item)
          .map((item: any) => ({
            rut: typeof item?.rut === 'string' ? item.rut : '',
            nombre: typeof item?.nombre === 'string' ? item.nombre : '',
          }))
          .filter((item: any) => item.rut && item.nombre)
      : [];

    return {
      id: raw?.id,
      mes: raw?.mes,
      nombre_actividad: raw?.nombre_actividad ?? '',
      satisfaccion: typeof raw?.satisfaccion === 'number' ? raw.satisfaccion : null,
      estudiantes: egresados.join(', '),
      terceros_asistieron: raw?.terceros_asistieron ?? false,
      fecha: raw?.fecha,
      horario: raw?.horario ?? undefined,
      lugar: raw?.lugar ?? undefined,
      archivo_adjunto: raw?.archivo_adjunto ?? undefined,
      terceros,
    };
  }

  listar(params?: QueryActividadParams): Observable<ActividadResponse> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((key) => {
        const value = params[key as keyof QueryActividadParams];
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http
      .get<ActividadEgresadosResponse>(API_URL, { params: httpParams })
      .pipe(
        map((res) => ({
          ...res,
          items: (res.items || []).map((item) => this.mapActividad(item)),
        }))
      );
  }

  obtenerPorId(id: number): Observable<Actividad> {
    return this.http
      .get<any>(`${API_URL}/${id}`)
      .pipe(map((raw) => this.mapActividad(raw)));
  }

  crear(actividad: Partial<Actividad> & { egresadosRuts?: string[] }, archivo?: File): Observable<Actividad> {
    const formData = new FormData();

    const fecha = actividad.fecha
      ? typeof actividad.fecha === 'string'
        ? new Date(actividad.fecha)
        : actividad.fecha
      : new Date();

    const fechaRegistro = this.formatearFechaLocal(fecha);

    formData.append('titulo', actividad.nombre_actividad || '');
    formData.append('descripcion', actividad.lugar || '');
    formData.append('horario', actividad.horario || '');
    formData.append('egresados', JSON.stringify(actividad.egresadosRuts || []));
    formData.append('tercerosAsistieron', (actividad.terceros_asistieron ?? false).toString());
    if (actividad.terceros) {
      formData.append('terceros', JSON.stringify(actividad.terceros));
    }
    formData.append('fechaRegistro', fechaRegistro);

    if (actividad.archivo_adjunto && !archivo) {
      if (!actividad.archivo_adjunto.startsWith('data:')) {
        formData.append('evidenciaUrl', actividad.archivo_adjunto);
      }
    }

    if (archivo) {
      formData.append('archivo', archivo);
    }

    return this.http
      .post<any>(API_URL, formData)
      .pipe(map((raw) => this.mapActividad(raw)));
  }

  actualizar(
    id: number,
    actividad: Partial<Actividad> & { egresadosRuts?: string[] },
    archivo?: File
  ): Observable<Actividad> {
    const formData = new FormData();

    if (actividad.nombre_actividad !== undefined) {
      formData.append('titulo', actividad.nombre_actividad);
    }
    if (actividad.lugar !== undefined) {
      formData.append('descripcion', actividad.lugar);
    }
    if (actividad.horario !== undefined) {
      formData.append('horario', actividad.horario);
    }
    if (actividad.terceros_asistieron !== undefined) {
      formData.append('tercerosAsistieron', actividad.terceros_asistieron.toString());
    }
    if (actividad.terceros !== undefined) {
      formData.append('terceros', JSON.stringify(actividad.terceros));
    }
    if (actividad.egresadosRuts !== undefined) {
      formData.append('egresados', JSON.stringify(actividad.egresadosRuts));
    }

    if (actividad.fecha) {
      const fecha = typeof actividad.fecha === 'string' ? new Date(actividad.fecha) : actividad.fecha;
      const fechaRegistro = this.formatearFechaLocal(fecha);
      formData.append('fechaRegistro', fechaRegistro);
    }

    if (actividad.archivo_adjunto && !archivo) {
      if (!actividad.archivo_adjunto.startsWith('data:')) {
        formData.append('evidenciaUrl', actividad.archivo_adjunto);
      }
    }

    if (archivo) {
      formData.append('archivo', archivo);
    }

    return this.http
      .patch<any>(`${API_URL}/${id}`, formData)
      .pipe(map((raw) => this.mapActividad(raw)));
  }

  obtenerTerceroPorRut(rut: string): Observable<{ rut: string; nombre: string } | null> {
    return this.http.get<{ rut: string; nombre: string } | null>(`${API_URL}/terceros/${rut}`);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`);
  }

  getArchivoUrl(archivoPath: string | undefined): string | null {
    if (!archivoPath) return null;

    if (archivoPath.startsWith('http://') || archivoPath.startsWith('https://')) {
      return archivoPath;
    }

    const path = archivoPath.startsWith('/') ? archivoPath : `/${archivoPath}`;
    return `${API_BASE_URL}${path}`;
  }

  listarPorEgresadoRut(
      rut: string,
      params?: QueryActividadParams
    ): Observable<ActividadResponse> {
      let httpParams = new HttpParams();

      // params page/limit/etc
      if (params) {
        Object.keys(params).forEach((key) => {
          const value = params[key as keyof QueryActividadParams];
          if (value !== undefined && value !== null && value !== '') {
            httpParams = httpParams.set(key, value.toString());
          }
        });
      }

      // filtro por rut (query param)
      httpParams = httpParams.set('egresadoRut', rut);

      return this.http
        .get<ActividadEgresadosResponse>(API_URL, { params: httpParams })
        .pipe(
          map((res) => ({
            ...res,
            items: (res.items || []).map((item) => this.mapActividad(item)),
          }))
        );
    }


}
