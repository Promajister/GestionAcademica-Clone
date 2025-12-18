import { Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialogModule } from '@angular/material/dialog';

// Servicios
import {
  PracticasService,
  Estudiante,
  CentroEducativo,
  Colaborador,
  EstadoPractica,
  TutorRol,
} from '../../services/practicas.service';
import { ColaboradoresService } from '../../services/colaboradores.service';
import { TutoresService, Tutor } from '../../services/tutores.service';
import { ObservacionesService, Observacion } from '../../services/observaciones.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Tipos de práctica (como string libre)
type TipoPractica = string;

interface Actividad {
  id: number;
  titulo: string;
  descripcion?: string;
  fecha: string;
  completada: boolean;
}

// Interface local para compatibilidad con la vista (mapeo de API)
interface Practica {
  id: number;
  estado: EstadoPractica;
  fechaInicio: string;
  fechaTermino?: string;
  tipo?: TipoPractica;
  estudiante: Estudiante;
  centro: CentroEducativo;
  colaboradores: Colaborador[];
  tutores: { tutor: Tutor; rol: TutorRol }[];
  actividades?: Actividad[];
  observaciones?: Observacion[];
}

@Component({
  standalone: true,
  selector: 'app-practicas',
  templateUrl: './practicas.component.html',
  styleUrls: ['./practicas.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatAutocompleteModule,
    MatPaginatorModule,
    MatDialogModule
  ]
})
export class PracticasComponent {
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private practicasService = inject(PracticasService);
  private colaboradoresService = inject(ColaboradoresService);
  private tutoresService = inject(TutoresService);
  private observacionesService = inject(ObservacionesService);
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  // Filtros
  terminoBusqueda = '';
  colegioSeleccionado: 'all' | string = 'all';
  nivelSeleccionado: 'all' | string = 'all';
  
  // ===== paginación =====
  pageIndex = 0;
  pageSize = 5;
  totalItems = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];

  // Estado para modal de detalles
  practicaSeleccionada: Practica | null = null;
  mostrarModalDetalles = false;
  
  // Estado para observaciones
  observaciones: Observacion[] = [];
  mostrarFormularioObservacion = false;
  observacionEditando: Observacion | null = null;
  formularioObservacion: FormGroup;
  
  // Verificar si el usuario es coordinadora de prácticas
  get esCoordinadoraPracticas(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      const roleStr = localStorage.getItem('app.selectedRole');
      if (!roleStr) return false;
      const role = JSON.parse(roleStr);
      return role?.id === 'practicas';
    } catch {
      return false;
    }
  }

  // Estado para modal de formulario
  mostrarFormulario = false;
  formularioPractica: FormGroup;

  // Propiedades para autocompletado
  estudianteFiltrado: Estudiante[] = [];
  centroFiltrado: CentroEducativo[] = [];

  // Datos para los selects (se cargan desde la API)
  estudiantes: Estudiante[] = [];
  centros: CentroEducativo[] = [];
  colaboradores: Colaborador[] = [];
  tutores: Tutor[] = [];

  // Opciones de tipos de práctica
  tiposPractica: string[] = [
    'PRÁCTICA DE APOYO A LA DOCENCIA I',
    'PRÁCTICA DE APOYO A LA DOCENCIA II',
    'PRÁCTICA DE APOYO A LA DOCENCIA III',
    'PRÁCTICA DE APOYO A LA DOCENCIA IV',
    'PRÁCTICA PROFESIONAL DOCENTE'
  ];

  // Opciones de niveles/plan (derivadas de los datos cargados)
  niveles: string[] = [];
  // Tipos de centro educativo (derivados de los datos cargados)
  tiposCentro: string[] = [];

  estadosPractica: EstadoPractica[] = [
    'EN_CURSO',
    'APROBADO',
    'REPROBADO'
  ];

  rolesTutor: TutorRol[] = ['Supervisor', 'Tallerista'];

  // Función para formatear el estado para mostrar al usuario
  formatearEstado(estado: EstadoPractica): string {
    const formato: Record<EstadoPractica, string> = {
      'EN_CURSO': 'En Curso',
      'APROBADO': 'Aprobado',
      'REPROBADO': 'Reprobado'
    };
    return formato[estado] || estado;
  }

  // Función para formatear el tipo de centro educativo
  formatearTipoCentro(tipo: string | null | undefined): string {
    if (!tipo) return 'Sin especificar';
    const formato: Record<string, string> = {
      'PARTICULAR': 'Particular',
      'PARTICULAR_SUBVENCIONADO': 'Particular Subvencionado',
      'SLEP': 'SLEP',
      'NO_CONVENCIONAL': 'No Convencional'
    };
    return formato[tipo] || tipo;
  }

  // Propiedades para las fechas mínimas del datepicker
  fechaMinimaTermino: Date | null = null;

  // Validador personalizado para verificar que fecha_termino no sea anterior a fecha_inicio
  validarFechas = (formGroup: FormGroup): { [key: string]: any } | null => {
    const fechaInicio = formGroup.get('fecha_inicio')?.value;
    const fechaTermino = formGroup.get('fecha_termino')?.value;

    if (fechaInicio && fechaTermino) {
      const inicio = new Date(fechaInicio);
      const termino = new Date(fechaTermino);

      if (termino < inicio) {
        formGroup.get('fecha_termino')?.setErrors({ fechaAnterior: true });
        return { fechaInvalida: true };
      }
    }

    if (formGroup.get('fecha_termino')?.hasError('fechaAnterior')) {
      formGroup.get('fecha_termino')?.setErrors(null);
    }

    return null;
  }

  constructor() {
    // Inicializar formulario con validaciones personalizadas
    this.formularioPractica = this.fb.group({
      estudianteRut: ['', [Validators.required]],
      centroId: ['', [Validators.required]],
      colaborador1Id: [null, [Validators.required]],
      colaborador2Id: [null],
      tutor1Id: [null, [Validators.required]],
      tutor1Rol: ['', [Validators.required]],
      tutor2Id: [null],
      tutor2Rol: [{value: '', disabled: true}],
      fecha_inicio: ['', Validators.required],
      fecha_termino: [''],
      tipo: [''],
      estado: ['PENDIENTE']
    }, { validators: this.validarFechas });

    // Inicializar formulario de observaciones
    this.formularioObservacion = this.fb.group({
      descripcion: ['', [Validators.required, Validators.minLength(3)]]
    });

    // Validación para evitar que tutor2 sea igual a tutor1
    this.formularioPractica.get('tutor1Id')?.valueChanges.subscribe((value) => {
      const tutor2Id = this.formularioPractica.get('tutor2Id')?.value;
      if (value && tutor2Id && value === tutor2Id) {
        this.formularioPractica.patchValue({ 
          tutor2Id: null,
          tutor2Rol: ''
        }, { emitEvent: false });
        this.snack.open('El Tutor 2 no puede ser el mismo que el Tutor 1', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['warning-snackbar']
        });
      }
    });

    this.formularioPractica.get('tutor2Id')?.valueChanges.subscribe((value) => {
      const tutor1Id = this.formularioPractica.get('tutor1Id')?.value;
      
      // Validar que tutor2 no sea igual a tutor1
      if (value && tutor1Id && value === tutor1Id) {
        this.formularioPractica.patchValue({ 
          tutor2Id: null,
          tutor2Rol: ''
        }, { emitEvent: false });
        this.snack.open('El Tutor 2 no puede ser el mismo que el Tutor 1', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['warning-snackbar']
        });
        return;
      }

      const rolControl = this.formularioPractica.get('tutor2Rol');
      if (value !== null && value !== undefined && value !== '') {
        rolControl?.enable();
        rolControl?.setValidators([Validators.required]);
      } else {
        rolControl?.disable();
        rolControl?.clearValidators();
        rolControl?.setValue('', { emitEvent: false });
      }
      rolControl?.updateValueAndValidity({ emitEvent: false });
    });

    this.formularioPractica.get('tutor2Rol')?.valueChanges.subscribe((value) => {
      const tutorControl = this.formularioPractica.get('tutor2Id');
      if (value && (value as string).trim()) {
        tutorControl?.setValidators([Validators.required]);
      } else {
        tutorControl?.clearValidators();
      }
      tutorControl?.updateValueAndValidity({ emitEvent: false });
    });

    // Suscribirse a cambios en fecha_inicio para actualizar fechaMinimaTermino
    this.formularioPractica.get('fecha_inicio')?.valueChanges.subscribe(fechaInicio => {
      if (fechaInicio) {
        this.fechaMinimaTermino = new Date(fechaInicio);
        const fechaTermino = this.formularioPractica.get('fecha_termino')?.value;
        if (fechaTermino && new Date(fechaTermino) < new Date(fechaInicio)) {
          this.formularioPractica.patchValue({ fecha_termino: '' }, { emitEvent: false });
        }
      }
    });

    // Cargar datos desde las APIs
    this.cargarDatosIniciales();
  }

  // Cargar datos iniciales desde las APIs
  cargarDatosIniciales() {
    // Cargar prácticas primero para filtrar estudiantes
    this.practicasService.listar().subscribe({
      next: (practicas) => {
        this.practicas = practicas.map((p: any) => this.transformarPractica(p));
        this.recalcularNivelesDesdeDatos();
        this.actualizarPaginacion();
        
        // Extraer RUTs de estudiantes con prácticas EN_CURSO
        const rutConPracticasEnCurso = new Set<string>();
        this.practicas.forEach((p: any) => {
          if (p.estudiante?.rut && p.estado === 'EN_CURSO') {
            rutConPracticasEnCurso.add(p.estudiante.rut);
          }
        });

        // Cargar estudiantes y filtrar solo los que tienen prácticas EN_CURSO
        this.http.get<any[]>(`${environment.apiUrl}/estudiantes`).subscribe({
          next: (estudiantes) => {
            this.estudiantes = estudiantes.filter(est => !rutConPracticasEnCurso.has(est.rut));
            this.estudianteFiltrado = this.estudiantes.slice(0, 5);
          },
          error: (err) => { console.error('Error al cargar estudiantes:', err); }
        });

        // Cargar otros datos
        this.cargarCentrosColaboradoresYTutores();
      },
      error: (err) => {
        console.error('Error al cargar prácticas:', err);
        this.cargarTodosEstudiantes();
      }
    });
  }

  cargarTodosEstudiantes() {
    this.http.get<any[]>(`${environment.apiUrl}/estudiantes`).subscribe({
      next: (estudiantes) => {
        this.estudiantes = estudiantes;
        this.estudianteFiltrado = this.estudiantes.slice(0, 5);
      },
      error: (err) => { console.error('Error al cargar estudiantes:', err); }
    });
  }

  cargarCentrosColaboradoresYTutores() {
    // Cargar centros educativos
    this.http.get<any>(`${environment.apiUrl}/centros?page=1&limit=100`).subscribe({
      next: (response) => {
        this.centros = response.items || [];
        this.centroFiltrado = this.centros.slice(0, 5);
        const setTipos = new Set<string>();
        this.centros.forEach(c => { 
          const t = (c.tipo || '').trim(); 
          if (t) setTipos.add(t); 
        });
        this.tiposCentro = Array.from(setTipos).sort((a, b) => a.localeCompare(b));
      },
      error: (err) => { console.error('Error al cargar centros:', err); }
    });

    // Cargar colaboradores
    this.colaboradoresService.listar({ page: 1, limit: 100 }).subscribe({
      next: (response) => {
        this.colaboradores = response.items || [];
      },
      error: (err) => { console.error('Error al cargar colaboradores:', err); }
    });

    // Cargar tutores
    this.tutoresService.listar({ page: 1, limit: 1000 }).subscribe({
      next: (response) => {
        this.tutores = response.items || [];
      },
      error: (err) => { console.error('Error al cargar tutores:', err); }
    });
  }

  // Cargar prácticas desde la API
  cargarPracticas() {
    this.practicasService.listar().subscribe({
      next: (practicas) => {
        this.practicas = practicas.map((p: any) => this.transformarPractica(p));
        this.recalcularNivelesDesdeDatos();
        this.actualizarEstudiantesDisponibles();
        this.actualizarPaginacion();
      },
      error: (err) => {
        console.error('Error al cargar prácticas:', err);
        this.snack.open('Error al cargar prácticas', 'Cerrar', { duration: 3000 });
      }
    });
  }

  // Actualizar lista de estudiantes disponibles (solo excluir los que tienen prácticas EN_CURSO)
  actualizarEstudiantesDisponibles() {
    const rutConPracticasEnCurso = new Set<string>();
    this.practicas.forEach((p: any) => {
      if (p.estudiante?.rut && p.estado === 'EN_CURSO') {
        rutConPracticasEnCurso.add(p.estudiante.rut);
      }
    });

    this.http.get<any[]>(`${environment.apiUrl}/estudiantes`).subscribe({
      next: (estudiantes) => {
        this.estudiantes = estudiantes.filter(est => !rutConPracticasEnCurso.has(est.rut));
        this.estudianteFiltrado = this.estudiantes.slice(0, 5);
      },
      error: (err) => { console.error('Error al actualizar estudiantes:', err); }
    });
  }

  // Transformar datos de la API al formato local
  transformarPractica(p: any): Practica {
    const formatearFecha = (fecha: any): string => {
      if (!fecha) return '';
      const date = new Date(fecha);
      return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const colaboradores = Array.isArray(p.practicaColaboradores)
      ? p.practicaColaboradores.map((pc: any) => ({
          id: pc.colaborador?.id || 0,
          nombre: pc.colaborador?.nombre || '',
          correo: pc.colaborador?.correo,
          tipo: pc.colaborador?.tipo,
          cargo: pc.colaborador?.cargo,
          telefono: pc.colaborador?.telefono,
        }))
      : [];

    const tutores = Array.isArray(p.practicaTutores)
      ? p.practicaTutores.map((pt: any) => ({
          tutor: {
            id: pt.tutor?.id || 0,
            rut: pt.tutor?.rut || '',
            nombre: pt.tutor?.nombre || '',
            correo: pt.tutor?.correo,
            telefono: pt.tutor?.telefono,
            cargo: pt.tutor?.cargo,
            universidad_egreso: pt.tutor?.universidad_egreso,
            direccion: pt.tutor?.direccion,
          } as Tutor,
          rol: (pt.rol as TutorRol) || 'Supervisor',
        }))
      : [];

    const observaciones = p.observaciones ? p.observaciones.map((obs: any) => ({
      id: obs.id,
      descripcion: obs.descripcion,
      fecha: obs.fecha,
      createdAt: obs.createdAt,
      updatedAt: obs.updatedAt,
      practicaId: obs.practicaId
    })) : undefined;

    return {
      id: p.id,
      estado: p.estado,
      fechaInicio: formatearFecha(p.fecha_inicio) || p.fecha_inicio,
      fechaTermino: p.fecha_termino ? formatearFecha(p.fecha_termino) : undefined,
      tipo: p.tipo,
      estudiante: {
        rut: p.estudiante?.rut || '',
        nombre: p.estudiante?.nombre || '',
        nivel: p.estudiante?.plan || p.estudiante?.nivel || '',
        email: p.estudiante?.email
      },
      centro: {
        id: p.centro?.id || 0,
        nombre: p.centro?.nombre || '',
        direccion: p.centro?.direccion,
        tipo: p.centro?.tipo,
        region: p.centro?.region,
        comuna: p.centro?.comuna,
        convenio: p.centro?.convenio
      },
      colaboradores,
      tutores,
      actividades: [],
      observaciones
    };
  }

  // Datos de prácticas (se cargan desde la API)
  practicas: Practica[] = [];

  // FILTROS
  get asignacionesFiltradas(): Practica[] {
    const termino = this.terminoBusqueda.toLowerCase().trim();

    return this.practicas.filter(practica => {
      if (!practica || !practica.estudiante || !practica.centro) return false;
      const nombresColaboradores = practica.colaboradores?.map(c => c.nombre?.toLowerCase() || '') ?? [];
      const coincideBusqueda = !termino ||
        practica.estudiante.nombre?.toLowerCase().includes(termino) ||
        practica.estudiante.rut?.toLowerCase().includes(termino) ||
        practica.centro.nombre?.toLowerCase().includes(termino) ||
        nombresColaboradores.some(nombre => nombre.includes(termino));

      const coincideColegio = this.colegioSeleccionado === 'all' ||
        (practica.centro.tipo || '').toLowerCase() === this.colegioSeleccionado.toLowerCase();

      const coincideNivel = this.nivelSeleccionado === 'all' ||
        (practica.estudiante.nivel || '').toLowerCase() === this.nivelSeleccionado.toLowerCase();

      return coincideBusqueda && coincideColegio && coincideNivel;
    });
  }

  // ===== items paginados de los filtrados =====
  get asignacionesPaginadas(): Practica[] {
    const filtradas = this.asignacionesFiltradas;
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return filtradas.slice(startIndex, endIndex);
  }

  // Actualizar paginación cuando cambian los filtros o datos
  actualizarPaginacion(): void {
    this.totalItems = this.asignacionesFiltradas.length;
    // Asegurar que pageIndex no exceda el número de páginas disponibles
    const maxPage = Math.max(0, Math.ceil(this.totalItems / this.pageSize) - 1);
    if (this.pageIndex > maxPage) {
      this.pageIndex = maxPage;
    }
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.actualizarPaginacion();
  }

  onFiltersChange(): void {
    this.pageIndex = 0;
    this.actualizarPaginacion();
  }

  private recalcularNivelesDesdeDatos() {
    const set = new Set<string>();
    this.practicas.forEach(p => {
      const n = (p.estudiante?.nivel || '').trim();
      if (n) set.add(n);
    });
    this.niveles = Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  abrirNuevaAsignacion() {
    this.mostrarFormulario = true;
    this.formularioPractica.reset({
      estado: 'EN_CURSO',
      colaborador1Id: null,
      colaborador2Id: null,
      tutor1Id: null,
      tutor1Rol: '',
      tutor2Id: null,
      tutor2Rol: '',
      fecha_inicio: '',
      fecha_termino: ''
    });
    this.fechaMinimaTermino = null;
    this.estudianteFiltrado = [...this.estudiantes];
    this.centroFiltrado = [...this.centros];
  }

  cerrarFormulario() {
    this.mostrarFormulario = false;
    this.formularioPractica.reset({
      estado: 'EN_CURSO',
      colaborador1Id: null,
      colaborador2Id: null,
      tutor1Id: null,
      tutor1Rol: '',
      tutor2Id: null,
      tutor2Rol: '',
      fecha_inicio: '',
      fecha_termino: ''
    });
    this.fechaMinimaTermino = null;
  }

  // Métodos de filtrado para autocompletado (máximo 5 resultados)
  filtrarEstudiantes(event: any) {
    const filtro = (event?.target?.value || '').toLowerCase();
    let filtrados: Estudiante[];
    if (!filtro) filtrados = this.estudiantes.slice(0, 5);
    else {
      filtrados = this.estudiantes.filter(e =>
        e.nombre.toLowerCase().includes(filtro) ||
        e.rut.toLowerCase().includes(filtro)
      ).slice(0, 5);
    }
    this.estudianteFiltrado = filtrados;
  }

  filtrarCentros(event: any) {
    const filtro = (event?.target?.value || '').toLowerCase();
    let filtrados: CentroEducativo[];
    if (!filtro) filtrados = this.centros.slice(0, 5);
    else {
      filtrados = this.centros.filter(c =>
        c.nombre.toLowerCase().includes(filtro) ||
        c.comuna?.toLowerCase().includes(filtro) ||
        c.region?.toLowerCase().includes(filtro)
      ).slice(0, 5);
    }
    this.centroFiltrado = filtrados;
  }

  // Mostrar los primeros 5 elementos al enfocar
  mostrarTodosEstudiantes() { this.estudianteFiltrado = this.estudiantes.slice(0, 5); }
  mostrarTodosCentros() { this.centroFiltrado = this.centros.slice(0, 5); }

  // displayWith helpers
  mostrarEstudiante(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') {
      const est = this.estudiantes.find(e => e.rut === value);
      return est ? `${est.nombre} - ${est.rut}` : '';
    }
    if (typeof value === 'object' && value.rut) return `${value.nombre} - ${value.rut}`;
    return '';
  }

  isColaboradorSeleccionado(colaboradorId: number | null, control: 'colaborador1Id' | 'colaborador2Id'): boolean {
    if (colaboradorId === null || colaboradorId === undefined) return false;
    const otroControl = control === 'colaborador1Id' ? 'colaborador2Id' : 'colaborador1Id';
    return this.formularioPractica.get(otroControl)?.value === colaboradorId;
  }

  isTutorSeleccionado(tutorId: number | null, control: 'tutor1Id' | 'tutor2Id'): boolean {
    if (tutorId === null || tutorId === undefined) return false;
    const otroControl = control === 'tutor1Id' ? 'tutor2Id' : 'tutor1Id';
    return this.formularioPractica.get(otroControl)?.value === tutorId;
  }

  formatColaboradores(colaboradores?: Colaborador[]): string {
    if (!colaboradores || colaboradores.length === 0) return 'Sin colaboradores';
    return colaboradores
      .map((c) => c.nombre)
      .filter((nombre): nombre is string => !!nombre && nombre.trim().length > 0)
      .join(', ') || 'Sin colaboradores';
  }

  formatTutores(tutores?: { tutor: Tutor; rol: TutorRol }[]): string {
    if (!tutores || tutores.length === 0) return 'Sin tutores';
    const etiquetas = tutores
      .map((t) => {
        const nombre = t.tutor?.nombre?.trim();
        const rol = t.rol ?? 'Supervisor';
        return nombre ? `${nombre} (${rol})` : null;
      })
      .filter((texto): texto is string => !!texto);
    return etiquetas.length ? etiquetas.join(', ') : 'Sin tutores';
  }

  mostrarCentro(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') {
      const id = parseInt(value);
      const c = this.centros.find(x => x.id === id);
      return c ? `${c.nombre} - ${c.comuna}, ${c.region}` : '';
    }
    if (typeof value === 'number') {
      const c = this.centros.find(x => x.id === value);
      return c ? `${c.nombre} - ${c.comuna}, ${c.region}` : '';
    }
    if (typeof value === 'object' && value.id) {
      return `${value.nombre} - ${value.comuna}, ${value.region}`;
    }
    return '';
  }

  // Single select (compatibilidad en otros campos)
  onEstudianteSeleccionado(event: any) {
    const estudiante = event.option.value;
    this.formularioPractica.patchValue({ estudianteRut: estudiante.rut });
  }

  onCentroSeleccionado(event: any) {
    const centro = event.option.value;
    this.formularioPractica.patchValue({ centroId: centro.id.toString() });
  }

  guardarPractica() {
    if (this.formularioPractica.invalid) {
      this.formularioPractica.markAllAsTouched();
      this.snack.open('⚠️ Por favor completa todos los campos requeridos', 'Cerrar', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['warning-snackbar']
      });
      return;
    }

    const formData = this.formularioPractica.value;
    const toNumber = (value: any): number | null => {
      if (value === null || value === undefined || value === '') return null;
      const num = Number(value);
      return Number.isNaN(num) ? null : num;
    };

    const colaboradorIds = [toNumber(formData.colaborador1Id), toNumber(formData.colaborador2Id)]
      .filter((id): id is number => id !== null);

    if (!colaboradorIds.length) {
      this.snack.open('Debes seleccionar al menos un colaborador.', 'Cerrar', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['warning-snackbar']
      });
      return;
    }

    if (new Set(colaboradorIds).size !== colaboradorIds.length) {
      this.snack.open('Los colaboradores no pueden repetirse.', 'Cerrar', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['warning-snackbar']
      });
      return;
    }

    const tutorEntries = [
      { id: toNumber(formData.tutor1Id), rol: (formData.tutor1Rol || '').trim() },
      { id: toNumber(formData.tutor2Id), rol: (formData.tutor2Rol || '').trim() }
    ].filter(entry => entry.id !== null);

    if (!tutorEntries.length) {
      this.snack.open('Debes seleccionar al menos un tutor.', 'Cerrar', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['warning-snackbar']
      });
      return;
    }

    if (tutorEntries.some(entry => !entry.rol)) {
      this.snack.open('Debes asignar un rol a cada tutor seleccionado.', 'Cerrar', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['warning-snackbar']
      });
      return;
    }

    const tutorIds = tutorEntries.map((entry) => entry.id!) as number[];
    if (new Set(tutorIds).size !== tutorIds.length) {
      this.snack.open('Los tutores no pueden repetirse.', 'Cerrar', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['warning-snackbar']
      });
      return;
    }

    const centroId = toNumber(formData.centroId);
    if (centroId === null) {
      this.snack.open('Debes seleccionar un centro educativo válido.', 'Cerrar', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['warning-snackbar']
      });
      return;
    }

    const fechaInicio = this.formatearFechaISO(formData.fecha_inicio);
    if (!fechaInicio) {
      this.snack.open('La fecha de inicio es obligatoria.', 'Cerrar', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['warning-snackbar']
      });
      return;
    }

    const dto = {
      estudianteRut: formData.estudianteRut,
      centroId,
      colaboradorIds,
      tutorIds,
      tutorRoles: tutorEntries.map((entry) => entry.rol as TutorRol),
      fecha_inicio: fechaInicio,
      fecha_termino: formData.fecha_termino ? this.formatearFechaISO(formData.fecha_termino) : undefined,
      tipo: formData.tipo || undefined,
      estado: formData.estado || 'EN_CURSO'
    };

      this.practicasService.crear(dto).subscribe({
        next: () => {
          this.snack.open(
          '✓ Práctica asignada exitosamente',
            'Cerrar', 
            { duration: 4000, horizontalPosition: 'center', verticalPosition: 'bottom', panelClass: ['success-snackbar'] }
          );
          this.cargarPracticas();
          this.cerrarFormulario();
        },
        error: (err) => {
          console.error('Error al crear práctica:', err);
          let mensaje = 'Error al crear práctica';
          if (err.error && err.error.message) mensaje = err.error.message;
          this.snack.open(mensaje, 'Cerrar', {
            duration: 4000, horizontalPosition: 'center', verticalPosition: 'bottom', panelClass: ['error-snackbar']
          });
        }
      });
  }

  verDetalles(practica: Practica) {
    this.practicaSeleccionada = practica;
    this.mostrarModalDetalles = true;
    this.cargarObservaciones(practica.id);
  }

  cerrarDetalles() {
    this.practicaSeleccionada = null;
    this.mostrarModalDetalles = false;
    this.observaciones = [];
    this.mostrarFormularioObservacion = false;
    this.observacionEditando = null;
    this.formularioObservacion.reset();
  }

  cargarObservaciones(practicaId: number) {
    this.observacionesService.listar(practicaId).subscribe({
      next: (obs) => {
        this.observaciones = obs;
      },
      error: (err) => {
        console.error('Error al cargar observaciones:', err);
        this.observaciones = [];
      }
    });
  }

  abrirFormularioObservacion(observacion?: Observacion) {
    if (observacion) {
      this.observacionEditando = observacion;
      this.formularioObservacion.patchValue({ descripcion: observacion.descripcion });
    } else {
      this.observacionEditando = null;
      this.formularioObservacion.reset();
    }
    this.mostrarFormularioObservacion = true;
  }

  cerrarFormularioObservacion() {
    this.mostrarFormularioObservacion = false;
    this.observacionEditando = null;
    this.formularioObservacion.reset();
  }

  guardarObservacion() {
    if (this.formularioObservacion.invalid || !this.practicaSeleccionada) {
      this.formularioObservacion.markAllAsTouched();
      return;
    }

    const descripcion = this.formularioObservacion.value.descripcion;
    const practicaId = this.practicaSeleccionada.id;

    if (this.observacionEditando) {
      // Editar observación existente
      this.observacionesService.actualizar(practicaId, this.observacionEditando.id, { descripcion }).subscribe({
        next: () => {
          this.snack.open('Observación actualizada exitosamente', 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
          });
          this.cargarObservaciones(practicaId);
          this.cerrarFormularioObservacion();
        },
        error: (err) => {
          console.error('Error al actualizar observación:', err);
          this.snack.open('Error al actualizar la observación', 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['error-snackbar']
          });
        }
      });
    } else {
      // Crear nueva observación
      this.observacionesService.crear(practicaId, { descripcion }).subscribe({
        next: () => {
          this.snack.open('Observación creada exitosamente', 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
          });
          this.cargarObservaciones(practicaId);
          this.cerrarFormularioObservacion();
        },
        error: (err) => {
          console.error('Error al crear observación:', err);
          const mensaje = err.error?.message || 'Error al crear la observación';
          this.snack.open(mensaje, 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['error-snackbar']
          });
        }
      });
    }
  }

  eliminarObservacion(observacion: Observacion) {
    if (!this.practicaSeleccionada) return;
    
    if (!confirm('¿Está seguro de que desea eliminar esta observación?')) {
      return;
    }

    this.observacionesService.eliminar(this.practicaSeleccionada.id, observacion.id).subscribe({
      next: () => {
        this.snack.open('Observación eliminada exitosamente', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
        this.cargarObservaciones(this.practicaSeleccionada!.id);
      },
      error: (err) => {
        console.error('Error al eliminar observación:', err);
        const mensaje = err.error?.message || 'Error al eliminar la observación';
        this.snack.open(mensaje, 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Formatear fecha a ISO string
  private formatearFechaISO(fecha: any): string {
    if (!fecha) return '';
    if (fecha instanceof Date) return fecha.toISOString().split('T')[0];
    if (typeof fecha === 'string') return fecha;
    return '';
  }
}
