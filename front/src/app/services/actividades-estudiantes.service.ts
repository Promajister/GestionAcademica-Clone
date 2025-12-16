import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

const API_URL = `${environment.apiUrl}/actividad-practica`;
const API_BASE_URL = '';

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
  crear(actividad: Partial<Actividad>, archivo?: File): Observable<Actividad> {
    const formData = new FormData();
    
    // Mapear del formato del frontend al DTO del backend
    const fecha = actividad.fecha 
      ? (typeof actividad.fecha === 'string' 
          ? new Date(actividad.fecha) 
          : actividad.fecha)
      : new Date();
    
    // Usar formato local para evitar problemas de zona horaria
    const fechaRegistro = this.formatearFechaLocal(fecha); // YYYY-MM-DD
    
    // El backend mapea: titulo → nombre_actividad, descripcion → lugar, tallerista → horario, estudiante → estudiantes
    formData.append('titulo', actividad.nombre_actividad || '');
    formData.append('descripcion', actividad.lugar || '');
    formData.append('tallerista', actividad.horario || '');
    formData.append('estudiante', actividad.estudiantes || '');
    formData.append('fechaRegistro', fechaRegistro);
    
    // Si hay una URL de evidencia (base64 convertido a URL o URL directa)
    if (actividad.archivo_adjunto && !archivo) {
      // Si es base64, el backend espera que se suba como archivo
      // Si es URL, se puede enviar directamente
      if (!actividad.archivo_adjunto.startsWith('data:')) {
        formData.append('evidenciaUrl', actividad.archivo_adjunto);
      }
    }
    
    // Si hay un archivo, agregarlo al FormData
    if (archivo) {
      formData.append('archivo', archivo);
    }

    return this.http.post<Actividad>(API_URL, formData);
  }

  /**
   * Actualizar una actividad existente
   * @param id ID de la actividad
   * @param actividad Datos actualizados en formato del frontend
   * @param archivo Archivo opcional a subir
   */
  actualizar(id: number, actividad: Partial<Actividad>, archivo?: File): Observable<Actividad> {
    const formData = new FormData();
    
    // Mapear del formato del frontend al DTO del backend
    if (actividad.nombre_actividad !== undefined) {
      formData.append('titulo', actividad.nombre_actividad);
    }
    if (actividad.lugar !== undefined) {
      formData.append('descripcion', actividad.lugar);
    }
    if (actividad.horario !== undefined) {
      formData.append('tallerista', actividad.horario);
    }
    if (actividad.estudiantes !== undefined) {
      formData.append('estudiante', actividad.estudiantes);
    }
    
    if (actividad.fecha) {
      const fecha = typeof actividad.fecha === 'string' 
        ? new Date(actividad.fecha) 
        : actividad.fecha;
      const fechaRegistro = this.formatearFechaLocal(fecha);
      formData.append('fechaRegistro', fechaRegistro);
    }
    
    // Si hay una URL de evidencia y no hay archivo nuevo
    if (actividad.archivo_adjunto && !archivo) {
      if (!actividad.archivo_adjunto.startsWith('data:')) {
        formData.append('evidenciaUrl', actividad.archivo_adjunto);
      }
    }
    
    // Si hay un archivo nuevo, agregarlo al FormData
    if (archivo) {
      formData.append('archivo', archivo);
    }

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
