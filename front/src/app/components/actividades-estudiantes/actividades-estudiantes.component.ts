import { Component, inject, PLATFORM_ID, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, NativeDateAdapter, MAT_DATE_FORMATS, DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { Injectable } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ActividadesEstudiantesService, Actividad } from '../../services/actividades-estudiantes.service';
import JSZip from 'jszip';

// DateAdapter personalizado para formato DD/MM/YYYY
@Injectable()
export class CustomDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: Object): string {
    // Formatear siempre en DD/MM/YYYY para el input
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  override parse(value: string): Date | null {
    if (!value) return null;
    
    // Intentar parsear formato DD/MM/YYYY
    const parts = value.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Los meses en JS son 0-indexed
      const year = parseInt(parts[2], 10);
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const date = new Date(year, month, day);
        // Validar que la fecha es válida
        if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
          return date;
        }
      }
    }
    
    // Si no coincide, intentar con el formato nativo
    return super.parse(value);
  }
}

// Formato de fecha personalizado DD/MM/YYYY
export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  standalone: true,
  selector: 'app-actividades-estudiantes',
  templateUrl: './actividades-estudiantes.component.html',
  styleUrls: ['./actividades-estudiantes.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  providers: [
    { provide: DateAdapter, useClass: CustomDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
    { provide: MAT_DATE_LOCALE, useValue: 'es-ES' }
  ]
})
export class ActividadesEstudiantesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private platformId = inject(PLATFORM_ID);
  private snack = inject(MatSnackBar);
  private actividadesService = inject(ActividadesEstudiantesService);
  
  searchTerm: string = '';
  selectedMes: string = 'all';
  cargando: boolean = false;
  
  // Lista de meses disponibles
  readonly meses = [
    { value: 'all', label: 'Todos los meses' },
    { value: 'ENERO', label: 'Enero' },
    { value: 'FEBRERO', label: 'Febrero' },
    { value: 'MARZO', label: 'Marzo' },
    { value: 'ABRIL', label: 'Abril' },
    { value: 'MAYO', label: 'Mayo' },
    { value: 'JUNIO', label: 'Junio' },
    { value: 'JULIO', label: 'Julio' },
    { value: 'AGOSTO', label: 'Agosto' },
    { value: 'SEPTIEMBRE', label: 'Septiembre' },
    { value: 'OCTUBRE', label: 'Octubre' },
    { value: 'NOVIEMBRE', label: 'Noviembre' },
    { value: 'DICIEMBRE', label: 'Diciembre' }
  ];
  mostrarFormulario: boolean = false;
  estaEditando: boolean = false;
  actividadEditando: Actividad | null = null;
  pendingDelete: Actividad | null = null;
  actividadSeleccionada: Actividad | null = null;
  
  // Control de archivos adjuntos
  archivosSeleccionados: File[] = []; // Archivos originales seleccionados
  archivoZip: File | null = null; // ZIP comprimido
  estaComprimiendo: boolean = false;
  
  // Verificar si el usuario es jefatura (solo lectura)
  get esJefatura(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      const roleStr = localStorage.getItem('app.selectedRole');
      if (!roleStr) return false;
      const role = JSON.parse(roleStr);
      return role?.id === 'jefatura';
    } catch {
      return false;
    }
  }
  
  // ===== paginación =====
  pageIndex = 0;
  pageSize = 5;
  totalItems = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];
  
  // Formulario reactivo
  formularioActividad: FormGroup = this.fb.group({
    nombre_actividad: ['', [Validators.required]],
    fecha: ['', [Validators.required]],
    horario: [''],
    lugar: [''],
    estudiantes: [''],
    archivo_adjunto: ['']
  });
  
  actividades: Actividad[] = [];

  ngOnInit(): void {
    this.cargarActividades();
  }

  cargarActividades(): void {
    this.cargando = true;
    // Cargar un número grande de actividades para filtrar localmente
    const params = { page: 1, limit: 1000 };
    
    this.actividadesService.listar(params).subscribe({
      next: (response) => {
        this.actividades = response.items || [];
        this.cargando = false;
        this.actualizarPaginacion();
      },
      error: (err) => {
        console.error('Error al cargar actividades:', err);
        this.snack.open('Error al cargar actividades', 'Cerrar', { duration: 3000 });
        this.cargando = false;
      }
    });
  }

  // ===== filtros - aplicados localmente =====
  get filtradas(): Actividad[] {
    let resultado = [...this.actividades];

    // Filtrar por término de búsqueda
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      resultado = resultado.filter(actividad =>
        actividad.nombre_actividad.toLowerCase().includes(term)
      );
    }

    // Filtrar por mes
    if (this.selectedMes && this.selectedMes !== 'all') {
      resultado = resultado.filter(actividad =>
        actividad.mes === this.selectedMes
      );
    }

    return resultado;
  }

  // ===== items paginados de los filtrados =====
  get filteredActivities(): Actividad[] {
    const filtradas = this.filtradas;
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return filtradas.slice(startIndex, endIndex);
  }

  // Actualizar paginación cuando cambian los filtros o datos
  actualizarPaginacion(): void {
    this.totalItems = this.filtradas.length;
    // Asegurar que pageIndex no exceda el número de páginas disponibles
    const maxPage = Math.max(0, Math.ceil(this.totalItems / this.pageSize) - 1);
    if (this.pageIndex > maxPage) {
      this.pageIndex = maxPage;
    }
  }

  filterActivities(): void {
    this.pageIndex = 0;
    this.actualizarPaginacion();
  }

  onMesChange(): void {
    this.pageIndex = 0;
    this.actualizarPaginacion();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.actualizarPaginacion();
  }

  formatDate(date: Date | string): string {
    try {
      let d: Date;
      if (typeof date === 'string') {
        // Si es un string ISO, extraer año, mes y día y crear fecha en hora local
        // para evitar problemas de zona horaria
        if (date.includes('T')) {
          const fechaStr = date.split('T')[0]; // YYYY-MM-DD
          const [year, month, day] = fechaStr.split('-').map(Number);
          d = new Date(year, month - 1, day); // month es 0-indexed
        } else {
          d = new Date(date);
        }
      } else {
        d = date;
      }
      
      if (isNaN(d.getTime())) {
        return '—';
      }
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '—';
    }
  }

  formatTime(date: Date | string): string {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) {
        return '—';
      }
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    } catch {
      return '—';
    }
  }

  /**
   * Formatear el horario guardado en la BD (formato HH:MM) a formato legible (HH:MM AM/PM)
   * Si no hay horario guardado, usa la hora de la fecha
   */
  formatHorario(actividad: Actividad): string {
    // Si hay un horario guardado en la BD, usarlo
    if (actividad.horario && actividad.horario.trim()) {
      try {
        const [hora, minutos] = actividad.horario.split(':').map(Number);
        if (!isNaN(hora) && !isNaN(minutos)) {
          const ampm = hora >= 12 ? 'PM' : 'AM';
          let hora12 = hora % 12;
          hora12 = hora12 ? hora12 : 12;
          return `${hora12.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')} ${ampm}`;
        }
      } catch {
        // Si falla el parseo, continuar con la fecha
      }
    }
    
    // Si no hay horario o falló el parseo, usar la hora de la fecha
    return this.formatTime(actividad.fecha);
  }

  alternarFormulario(): void {
    // Si es jefatura, no permitir abrir el formulario
    if (this.esJefatura) return;
    
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) {
      this.estaEditando = false;
      this.actividadEditando = null;
      this.formularioActividad.reset();
      this.archivosSeleccionados = [];
      this.archivoZip = null;
    }
  }

  addActivity(): void {
    if (this.mostrarFormulario) {
      this.alternarFormulario();
    } else {
      this.estaEditando = false;
      this.actividadEditando = null;
      this.formularioActividad.reset();
      this.archivosSeleccionados = [];
      this.archivoZip = null;
      this.mostrarFormulario = true;
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      // Convertir FileList a Array y agregar a la lista existente
      const nuevosArchivos = Array.from(input.files);
      
      // Validar y filtrar solo archivos permitidos (PDF, JPG, PNG)
      const archivosPermitidos: File[] = [];
      const archivosRechazados: string[] = [];
      
      for (const nuevoArchivo of nuevosArchivos) {
        const extension = nuevoArchivo.name.toLowerCase().split('.').pop();
        const tipoMime = nuevoArchivo.type.toLowerCase();
        
        // Validar extensión y tipo MIME
        const esValido = 
          (extension === 'pdf' || extension === 'jpg' || extension === 'jpeg' || extension === 'png') &&
          (tipoMime === 'application/pdf' || tipoMime === 'image/jpeg' || tipoMime === 'image/png' || tipoMime === '');
        
        if (esValido) {
          // Verificar si ya existe (evitando duplicados)
          const existe = this.archivosSeleccionados.some(
            archivo => archivo.name === nuevoArchivo.name && archivo.size === nuevoArchivo.size
          );
          if (!existe) {
            archivosPermitidos.push(nuevoArchivo);
          }
        } else {
          archivosRechazados.push(nuevoArchivo.name);
        }
      }
      
      // Mostrar mensaje si hay archivos rechazados
      if (archivosRechazados.length > 0) {
        this.snack.open(
          `Los siguientes archivos no son válidos (solo se permiten PDF, JPG y PNG): ${archivosRechazados.join(', ')}`,
          'Cerrar',
          {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['error-snackbar']
          }
        );
      }
      
      // Agregar archivos válidos a la lista
      if (archivosPermitidos.length > 0) {
        this.archivosSeleccionados.push(...archivosPermitidos);
        // Comprimir archivos en ZIP
        await this.comprimirArchivos();
      }
      
      // Limpiar el input para permitir seleccionar el mismo archivo nuevamente si es necesario
      input.value = '';
    }
  }

  async comprimirArchivos(): Promise<void> {
    if (this.archivosSeleccionados.length === 0) {
      this.archivoZip = null;
      return;
    }

    this.estaComprimiendo = true;

    try {
      const zip = new JSZip();

      // Agregar cada archivo al ZIP
      for (const file of this.archivosSeleccionados) {
        const fileData = await this.leerArchivoComoArrayBuffer(file);
        zip.file(file.name, fileData);
      }

      // Generar el ZIP como Blob
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Convertir el ZIP a File para poder enviarlo
      const zipFile = new File([zipBlob], `archivos_actividad_${Date.now()}.zip`, {
        type: 'application/zip'
      });

      // Guardar el ZIP por separado, manteniendo los archivos originales
      this.archivoZip = zipFile;
      this.estaComprimiendo = false;
    } catch (error) {
      console.error('Error al comprimir archivos:', error);
      this.estaComprimiendo = false;
      this.archivoZip = null;
      this.snack.open('Error al comprimir los archivos', 'Cerrar', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      });
    }
  }

  leerArchivoComoArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  eliminarArchivo(index: number): void {
    this.archivosSeleccionados.splice(index, 1);
    this.archivoZip = null;
    if (this.archivosSeleccionados.length > 0) {
      this.comprimirArchivos();
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  guardarActividad(): void {
    if (this.formularioActividad.invalid) {
      this.formularioActividad.markAllAsTouched();
      return;
    }

    const formValue = this.formularioActividad.value;
    const fechaCompleta = new Date(formValue.fecha);
    
    // Si hay horario, intentar parsearlo y combinarlo con la fecha
    if (formValue.horario) {
      const [hora, minutos] = formValue.horario.split(':').map(Number);
      if (!isNaN(hora) && !isNaN(minutos)) {
        fechaCompleta.setHours(hora, minutos, 0, 0);
      }
    }

    const actividadData: Partial<Actividad> = {
      nombre_actividad: formValue.nombre_actividad,
      fecha: fechaCompleta,
      horario: formValue.horario || undefined,
      lugar: formValue.lugar || undefined,
      estudiantes: formValue.estudiantes || undefined,
    };

    // Determinar qué archivo enviar (el ZIP comprimido)
    let archivoParaEnviar: File | undefined = undefined;
    
    if (this.estaEditando && this.actividadEditando) {
      // Al editar, NO se permiten cambios en los archivos adjuntos
      // Mantener el archivo existente si hay uno
      if (this.actividadEditando.archivo_adjunto) {
        actividadData.archivo_adjunto = this.actividadEditando.archivo_adjunto;
      }
      // NO enviar archivoParaEnviar (será undefined)
    } else {
      // Al crear nueva actividad, permitir subir archivos
      // Si hay un ZIP comprimido, usarlo
      if (this.archivoZip) {
        archivoParaEnviar = this.archivoZip;
      }
    }

    if (this.estaEditando && this.actividadEditando) {
      // Editar actividad existente (sin modificar archivos)
      this.cargando = true;
      this.actividadesService.actualizar(
        this.actividadEditando.id,
        actividadData,
        undefined // No enviar archivo nuevo al editar
      ).subscribe({
        next: (actividadActualizada) => {
          const index = this.actividades.findIndex(a => a.id === actividadActualizada.id);
          if (index !== -1) {
            this.actividades[index] = actividadActualizada;
          }
          this.snack.open(
            `✓ ${actividadActualizada.nombre_actividad} actualizada correctamente`,
            'Cerrar',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
              panelClass: ['success-snackbar'],
            }
          );
          this.cargando = false;
          this.actualizarPaginacion();
          this.alternarFormulario();
        },
        error: (err) => {
          console.error('Error al actualizar actividad:', err);
          let mensajeError = 'Error al actualizar actividad';
          if (err?.error?.message) {
            mensajeError = Array.isArray(err.error.message) 
              ? err.error.message.join(', ') 
              : err.error.message;
          }
          this.snack.open(mensajeError, 'Cerrar', { duration: 4000 });
          this.cargando = false;
        }
      });
    } else {
      // Agregar nueva actividad
      this.cargando = true;
      this.actividadesService.crear(actividadData, archivoParaEnviar).subscribe({
        next: (nuevaActividad) => {
          this.actividades.push(nuevaActividad);
          this.snack.open(
            `✓ ${nuevaActividad.nombre_actividad} agregada correctamente`,
            'Cerrar',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
              panelClass: ['success-snackbar'],
            }
          );
          this.cargando = false;
          this.actualizarPaginacion();
          this.alternarFormulario();
        },
        error: (err) => {
          console.error('Error al crear actividad:', err);
          let mensajeError = 'Error al crear actividad';
          if (err?.error?.message) {
            mensajeError = Array.isArray(err.error.message) 
              ? err.error.message.join(', ') 
              : err.error.message;
          }
          this.snack.open(mensajeError, 'Cerrar', { duration: 4000 });
          this.cargando = false;
        }
      });
    }
  }

  viewActivity(actividad: Actividad): void {
    // Cargar detalles completos desde el backend
    this.actividadesService.obtenerPorId(actividad.id).subscribe({
      next: (actividadCompleta) => {
        this.actividadSeleccionada = actividadCompleta;
      },
      error: (err) => {
        console.error('Error al cargar detalles de actividad:', err);
        // Si falla, usar los datos que ya tenemos
        this.actividadSeleccionada = actividad;
        this.snack.open('Error al cargar detalles completos', 'Cerrar', { duration: 3000 });
      }
    });
  }

  /**
   * Obtener la URL completa del archivo adjunto para descarga
   */
  getArchivoUrl(archivoPath: string | undefined): string | null {
    return this.actividadesService.getArchivoUrl(archivoPath);
  }

  cerrarDetalles(): void {
    this.actividadSeleccionada = null;
  }

  editActivity(actividad: Actividad): void {
    // Si es jefatura, no permitir editar
    if (this.esJefatura) return;
    
    this.actividadEditando = actividad;
    this.estaEditando = true;
    
    // Convertir fecha a formato para el datepicker
    // Si viene como string ISO, parsearla correctamente para evitar problemas de zona horaria
    let fecha: Date;
    if (typeof actividad.fecha === 'string') {
      // Si es un string ISO, extraer año, mes y día y crear fecha en hora local
      const fechaStr = actividad.fecha.split('T')[0]; // YYYY-MM-DD
      const [year, month, day] = fechaStr.split('-').map(Number);
      fecha = new Date(year, month - 1, day); // month es 0-indexed
    } else {
      fecha = actividad.fecha;
    }
    
    // Si hay un archivo adjunto, no podemos recuperar los archivos originales desde el ZIP guardado
    this.archivosSeleccionados = [];
    this.archivoZip = null;
    
    this.formularioActividad.patchValue({
      nombre_actividad: actividad.nombre_actividad,
      fecha: fecha,
      horario: actividad.horario || '',
      lugar: actividad.lugar || '',
      estudiantes: actividad.estudiantes || '',
      archivo_adjunto: actividad.archivo_adjunto || ''
    });
    
    this.mostrarFormulario = true;
  }

  askDelete(actividad: Actividad): void {
    // Si es jefatura, no permitir eliminar
    if (this.esJefatura) return;
    
    this.pendingDelete = actividad;
  }

  cancelDelete(): void {
    this.pendingDelete = null;
  }

  confirmDelete(): void {
    if (!this.pendingDelete) return;
    
    this.cargando = true;
    this.actividadesService.eliminar(this.pendingDelete.id).subscribe({
      next: () => {
        const index = this.actividades.findIndex(a => a.id === this.pendingDelete!.id);
        if (index !== -1) {
          this.actividades.splice(index, 1);
        }
        this.actualizarPaginacion();
        // Ajustar página si es necesario después de eliminar
        setTimeout(() => {
          if (this.filteredActivities.length === 0 && this.pageIndex > 0) {
            this.pageIndex--;
            this.actualizarPaginacion();
          }
        }, 100);
        this.snack.open('Actividad eliminada correctamente', 'Cerrar', { duration: 3000 });
        this.cargando = false;
        this.pendingDelete = null;
      },
      error: (err) => {
        console.error('Error al eliminar actividad:', err);
        let mensajeError = 'Error al eliminar actividad';
        if (err?.error?.message) {
          mensajeError = Array.isArray(err.error.message) 
            ? err.error.message.join(', ') 
            : err.error.message;
        }
        this.snack.open(mensajeError, 'Cerrar', { duration: 4000 });
        this.cargando = false;
        this.pendingDelete = null;
      }
    });
  }
}
