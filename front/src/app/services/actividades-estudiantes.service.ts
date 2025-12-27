import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = `${environment.apiUrl}/actividad-practica`;
const API_BASE_URL = environment.apiUrl.replace(/\/api$/, '');

// Interfaz que coincide con el modelo de Prisma (lo que devuelve el backend)
export interface Actividad {
  id: number;
  mes: string;
  nombre_actividad: string;
  estudiantes?: string;
  fecha: Date | string;
  horario?: string;
  lugar?: string;
  archivo_adjunto?: string;
}

// Respuesta paginada del backend
export interface ActividadResponse {
  items: Actividad[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Parámetros de consulta
export interface QueryActividadParams {
  search?: string;
  mes?: string;
  page?: number;
  limit?: number;
}

// DTO para crear/actualizar (formato que espera el backend)
export interface CreateActividadDto {
  titulo: string;
  descripcion: string;
  tallerista: string;
  estudiante: string;
  fechaRegistro?: string;
  evidenciaUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ActividadesEstudiantesService {
  constructor(private http: HttpClient) {}

  /**
   * Convertir fecha a formato YYYY-MM-DD usando hora local (sin conversión UTC)
   * Esto evita problemas de zona horaria que causan que la fecha retroceda un día
   */
  private formatearFechaLocal(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const day = fecha.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Obtener lista de actividades con filtros opcionales
   */
  listar(params?: QueryActividadParams): Observable<ActividadResponse> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key as keyof QueryActividadParams];
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<ActividadResponse>(API_URL, { params: httpParams });
  }

  /**
   * Obtener una actividad por ID
   */
  obtenerPorId(id: number): Observable<Actividad> {
    return this.http.get<Actividad>(`${API_URL}/${id}`);
  }

  /**
   * Crear una nueva actividad
   * @param actividad Datos de la actividad en formato del frontend
   * @param archivo Archivo opcional a subir
   */
  private appendIfNotEmpty(fd: FormData, key: string, value?: string) {
    const v = (value ?? '').trim();
    if (v) fd.append(key, v);
  }

  crear(actividad: Partial<Actividad> & { descripcion?: string }, archivo?: File): Observable<Actividad> {
    const formData = new FormData();

    const fecha = actividad.fecha
      ? (typeof actividad.fecha === 'string' ? new Date(actividad.fecha) : actividad.fecha)
      : new Date();

    const fechaRegistro = this.formatearFechaLocal(fecha);

    // requerido
    formData.append('titulo', (actividad.nombre_actividad ?? '').trim());
    formData.append('fechaRegistro', fechaRegistro);

    // opcionales (SOLO si vienen)
    this.appendIfNotEmpty(formData, 'descripcion', (actividad as any).descripcion ?? (actividad as any).lugar);
    this.appendIfNotEmpty(formData, 'tallerista', actividad.horario);
    this.appendIfNotEmpty(formData, 'estudiante', actividad.estudiantes);

    if (actividad.archivo_adjunto && !archivo && !actividad.archivo_adjunto.startsWith('data:')) {
      formData.append('evidenciaUrl', actividad.archivo_adjunto);
    }

    if (archivo) formData.append('archivo', archivo);

    return this.http.post<Actividad>(API_URL, formData);
  }

  /**
   * Actualizar una actividad existente
   * @param id ID de la actividad
   * @param actividad Datos actualizados en formato del frontend
   * @param archivo Archivo opcional a subir
   */
  
  actualizar(id: number, actividad: Partial<Actividad> & { descripcion?: string }, archivo?: File): Observable<Actividad> {
    const formData = new FormData();

    if (actividad.nombre_actividad !== undefined) {
      formData.append('titulo', (actividad.nombre_actividad ?? '').trim());
    }

    // opcionales: si viene undefined -> no tocar; si viene '' -> no enviar
    if ((actividad as any).descripcion !== undefined || (actividad as any).lugar !== undefined) {
      this.appendIfNotEmpty(formData, 'descripcion', (actividad as any).descripcion ?? (actividad as any).lugar);
    }

    if (actividad.horario !== undefined) {
      this.appendIfNotEmpty(formData, 'tallerista', actividad.horario);
    }

    if (actividad.estudiantes !== undefined) {
      this.appendIfNotEmpty(formData, 'estudiante', actividad.estudiantes);
    }

    if (actividad.fecha) {
      const fecha = typeof actividad.fecha === 'string' ? new Date(actividad.fecha) : actividad.fecha;
      formData.append('fechaRegistro', this.formatearFechaLocal(fecha));
    }

    if (actividad.archivo_adjunto && !archivo && !actividad.archivo_adjunto.startsWith('data:')) {
      formData.append('evidenciaUrl', actividad.archivo_adjunto);
    }

    if (archivo) formData.append('archivo', archivo);

    return this.http.patch<Actividad>(`${API_URL}/${id}`, formData);
  }

  /**
   * Eliminar una actividad
   */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`);
  }

  /**
   * Convertir base64 a File para poder subirlo
   * @param base64String String en formato data URL (data:image/png;base64,...)
   * @param filename Nombre del archivo
   */
  base64ToFile(base64String: string, filename: string): File {
    const arr = base64String.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new File([u8arr], filename, { type: mime });
  }

  /**
   * Construir la URL completa del archivo adjunto
   * @param archivoPath Ruta relativa del archivo (ej: uploads/actividades/archivo.zip)
   * @returns URL completa para descargar el archivo
   */
  getArchivoUrl(archivoPath: string | undefined): string | null {
    if (!archivoPath) return null;
    
    // Si ya es una URL completa, retornarla tal cual
    if (archivoPath.startsWith('http://') || archivoPath.startsWith('https://')) {
      return archivoPath;
    }
    
    // Si es una ruta relativa, construir la URL completa
    // Asegurarse de que la ruta comience con /uploads
    const path = archivoPath.startsWith('/') ? archivoPath : `/${archivoPath}`;
    return `${API_BASE_URL}${path}`;
  }
}
