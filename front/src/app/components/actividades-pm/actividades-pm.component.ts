import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';

type UnidadRow = { cod: string; unidad: string };
type ResponsableRow = { rut: string; nombre: string; tipo: string };
type EquipoRow = { rut: string; nombre: string; tipo: string };
type FinRow = { tipo: string; monto: number };
type CentroCostoRow = { tipo: string; codigo: string; nombre: string };
type InstRow = { tipo: string; nombre: string };


@Component({
  selector: 'app-actividades-pm',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
  ],
  templateUrl: './actividades-pm.component.html',
  styleUrls: ['./actividades-pm.component.scss']
})
export class ActividadesPmComponent implements OnInit {
  form!: FormGroup;

  // tablas (como en el sistema de las fotos)
  unidades: UnidadRow[] = [];
  responsables: ResponsableRow[] = [];
  equipoTrabajo: EquipoRow[] = [];
  equipoFiltrado: EquipoRow[] = [];
  financiamientos: FinRow[] = [];
  centrosCosto: CentroCostoRow[] = [];
  instituciones: InstRow[] = [];

  // columnas
  unidadCols = ['n', 'cod', 'unidad', 'accion'];
  responsableCols = ['n', 'rut', 'nombre', 'tipo', 'accion'];
  equipoCols = ['n', 'rut', 'nombre', 'tipo'];
  finCols = ['n', 'tipo', 'monto', 'accion'];
  ccCols = ['n', 'tipo', 'codigo', 'nombre', 'accion'];
  instCols = ['n', 'tipo', 'nombre', 'accion'];

  // catálogos (ajústalos según tu backend real)
  tiposResponsable = ['INTERNO', 'EXTERNO'];
  tiposVinculacion = ['VcM (Bidireccionales)', 'VcM (Unidireccionales)', 'Extensión', 'Otro'];
  areasVinculacion = ['Educación', 'Salud', 'Cultura', 'Territorio', 'Investigación', 'Otro'];
  areasImpacto = ['SELECCIONE', 'Educación', 'Social', 'Productivo', 'Territorial', 'Otro'];
  sedes = ['CASA MATRIZ ARICA', 'IQUIQUE', 'ANTOFAGASTA'];
  proyectos = ['SELECCIONE', 'PLAN DE MEJORA', 'PRACTICAS', 'OTRO'];

  equiposCatalogo = [
    'SELECCIONE',
    'TODOS',
    'DIRECTIVOS (UTA)',
    'DOCENTES (UTA)',
    'ESTUDIANTES (UTA)',
    'EXALUMNOS',
    'FUNCIONARIOS DE GESTIÓN (UTA)',
    'OTROS (EXTERNOS)'
  ];

  difusionCatalogo = [
    'SELECCIONE',
    'TODOS',
    'MEDIOS DIG. REDES SO',
    'PRENSA ESCRITA',
    'RADIO',
    'TELEVISIÓN',
    'VÍA PÚBLICA'
  ];

  participantesColumnas = [
    'DIRECTIVOS (UTA)',
    'DOCENTES (UTA)',
    'ESTUDIANTES (UTA)',
    'EXALUMNOS',
    'FUNCIONARIOS DE GESTIÓN (UTA)',
    'OTROS (EXTERNOS)'
  ];

  medidasImpacto = ['NO APLICA', 'ENCUESTA', 'INDICADOR', 'RÚBRICA', 'OTRA'];

  asistenciaFile: File | null = null;
  documentosFile: File | null = null;
  fotosFile: File | null = null;

  asistenciaFileName = '';
  documentosFileName = '';
  fotosFileName = '';


  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      proyecto: this.fb.group({
        unidadSearch: [''],
        responsableRut: [''],
        responsableNombre: [''],
        responsableTipo: ['INTERNO'],

        // campos de la actividad (como la foto)
        nombre: ['', [Validators.required, Validators.maxLength(200)]],
        objetivo: ['', [Validators.required, Validators.maxLength(400)]],
        descripcion: ['', [Validators.required, Validators.maxLength(1000)]],
        tipoVinculacion: ['', Validators.required],
        areaVinculacion: ['', Validators.required],
        areaImpacto: ['SELECCIONE', Validators.required],
        fechaInicio: ['', Validators.required],
        fechaTermino: ['', Validators.required],
        sede: ['', Validators.required],
        lugar: [''],
        ingresos: [0, [Validators.min(0)]],
        proyectoAsociado: ['SELECCIONE'],
        resultados: ['', [Validators.maxLength(1000)]],
      }),

      equipoTrabajo: this.fb.group({
        equipoFiltro: ['TODOS'],
      }),

      evidencias: this.fb.group({
        listaAsistenciaRef: [''],
        documentosRef: [''],
        fotosRef: [''],
        enlaceNoticia: [''],
        observaciones: [''],
      }),


      financiamiento: this.fb.group({
        finTipo: [''],
        finMonto: [0],
        ccTipo: [''],
        ccCodigo: [''],
        ccNombre: [''],
      }),

      participantes: this.fb.group({
        // inputs para instituciones
        instTipo: ['CONVENIO'],
        instNombre: [''],

        // matriz participantes (ASISTENTE/EXPOSITOR x columnas)
        ...this.buildParticipantesControls(),
      }),

      impacto: this.fb.group({
        impactoResponsableSearch: [''],
        medidaImpacto: ['NO APLICA', Validators.required],
        indicadorImpacto: ['', Validators.required],
        interpretacion: ['', Validators.required],
      }),

      difusion: this.fb.group({
        difusionEquipo: ['SELECCIONE', Validators.required],
        difusionUrl: ['', [this.urlOptionalValidator()]],
      }),
    });

    // dataset ejemplo (si ya tienes backend, elimínalo)
    this.equipoTrabajo = [
      { rut: '10.018.950-K', nombre: 'Nombre 1', tipo: 'DIRECTIVOS (UTA)' },
      { rut: '16.226.319-6', nombre: 'Nombre 2', tipo: 'DOCENTES (UTA)' },
      { rut: '18.943.018-3', nombre: 'Nombre 3', tipo: 'OTROS (EXTERNOS)' },
    ];
    this.aplicarFiltroEquipo();
  }

  // helpers
  fProy(name: string) {
    return (this.form.get('proyecto') as FormGroup).get(name)!;
  }

  fImp(name: string) {
    return (this.form.get('impacto') as FormGroup).get(name)!;
  }

  // =========================
  // Unidad
  // =========================
  buscarUnidad(): void {
    const q = String(this.fProy('unidadSearch').value ?? '').trim();
    if (!q) return;

    // Simulación: tu backend aquí
    this.unidades = [{ cod: '74', unidad: 'FACULTAD DE EDUCACIÓN Y HUMANIDADES' }];
    this.fProy('unidadSearch').setValue('');
  }

  removeUnidad(row: UnidadRow): void {
    this.unidades = this.unidades.filter(x => x !== row);
  }

  // =========================
  // Responsable
  // =========================
  addResponsable(): void {
    const rut = String(this.fProy('responsableRut').value ?? '').trim();
    const nombre = String(this.fProy('responsableNombre').value ?? '').trim();
    const tipo = String(this.fProy('responsableTipo').value ?? 'INTERNO');

    if (!rut || !nombre) return;

    this.responsables = [...this.responsables, { rut, nombre, tipo }];

    this.fProy('responsableRut').setValue('');
    this.fProy('responsableNombre').setValue('');
    this.fProy('responsableTipo').setValue('INTERNO');
  }

  removeResponsable(row: ResponsableRow): void {
    this.responsables = this.responsables.filter(x => x !== row);
  }

  // =========================
  // Equipo de trabajo (filtro)
  // =========================
  aplicarFiltroEquipo(): void {
    const filtro = String(this.form.get('equipoTrabajo.equipoFiltro')?.value ?? 'TODOS');

    if (filtro === 'TODOS') {
      this.equipoFiltrado = [...this.equipoTrabajo];
      return;
    }
    if (filtro === 'SELECCIONE') {
      this.equipoFiltrado = [];
      return;
    }
    this.equipoFiltrado = this.equipoTrabajo.filter(x => x.tipo === filtro);
  }

  // =========================
  // Financiamiento
  // =========================
  addFinanciamiento(): void {
    const g = this.form.get('financiamiento') as FormGroup;
    const tipo = String(g.get('finTipo')?.value ?? '').trim();
    const monto = Number(g.get('finMonto')?.value ?? 0);

    if (!tipo) return;

    this.financiamientos = [...this.financiamientos, { tipo, monto: isNaN(monto) ? 0 : monto }];
    g.get('finTipo')?.setValue('');
    g.get('finMonto')?.setValue(0);
  }

  removeFin(row: FinRow): void {
    this.financiamientos = this.financiamientos.filter(x => x !== row);
  }

  addCentroCosto(): void {
    const g = this.form.get('financiamiento') as FormGroup;
    const tipo = String(g.get('ccTipo')?.value ?? '').trim();
    const codigo = String(g.get('ccCodigo')?.value ?? '').trim();
    const nombre = String(g.get('ccNombre')?.value ?? '').trim();

    if (!tipo || !codigo || !nombre) return;

    this.centrosCosto = [...this.centrosCosto, { tipo, codigo, nombre }];
    g.get('ccTipo')?.setValue('');
    g.get('ccCodigo')?.setValue('');
    g.get('ccNombre')?.setValue('');
  }

  onFileSelected(event: Event, tipo: 'asistencia' | 'documentos' | 'fotos'): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  // Validaciones rápidas (ajusta si quieres)
  const maxMb = 10;
  const sizeOk = file.size <= maxMb * 1024 * 1024;

  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const allow = {
    asistencia: ['pdf', 'xls', 'xlsx'],
    documentos: ['pdf', 'xls', 'xlsx'],
    fotos: ['jpg', 'jpeg', 'png'],
  }[tipo];

  if (!allow.includes(ext) || !sizeOk) {
    // si quieres, aquí puedes mostrar snackBar
    console.warn(`Archivo inválido. Permitidos: ${allow.join(', ')}. Máx: ${maxMb}MB`);
    input.value = '';
    return;
  }

  if (tipo === 'asistencia') {
    this.asistenciaFile = file;
    this.asistenciaFileName = file.name;
  } else if (tipo === 'documentos') {
    this.documentosFile = file;
    this.documentosFileName = file.name;
  } else {
    this.fotosFile = file;
    this.fotosFileName = file.name;
  }
}


  removeCC(row: CentroCostoRow): void {
    this.centrosCosto = this.centrosCosto.filter(x => x !== row);
  }

  // =========================
  // Difusión
  // =========================

  private urlOptionalValidator() {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = String(control.value ?? '').trim();
    if (!v) return null; // opcional
    const ok = /^https?:\/\/.+/i.test(v);
    return ok ? null : { url: true };
  };
}

  // =========================
  // Participantes (matriz)
  // =========================
  private buildParticipantesControls(): Record<string, any> {
    const obj: Record<string, any> = {};
    const tipos = ['ASISTENTE', 'EXPOSITOR'];

    for (const t of tipos) {
      for (const col of this.participantesColumnas) {
        obj[this.key(t, col)] = [0, [Validators.min(0)]];
      }
    }
    return obj;
  }

  key(tipo: string, col: string): string {
    // clave segura para formControlName
    return `${tipo}__${col}`.replace(/\s+/g, '_').replace(/[()]/g, '');
  }

  grabarParticipantes(): void {
    // aquí normalmente llamas al backend
    const g = this.form.get('participantes') as FormGroup;
    console.log('Participantes (matriz):', g.value);
  }

  // =========================
  // Instituciones
  // =========================
  addInstitucion(): void {
    const g = this.form.get('participantes') as FormGroup;
    const tipo = String(g.get('instTipo')?.value ?? '').trim();
    const nombre = String(g.get('instNombre')?.value ?? '').trim();
    if (!tipo || !nombre) return;

    this.instituciones = [...this.instituciones, { tipo, nombre }];
    g.get('instNombre')?.setValue('');
  }

  removeInstitucion(row: InstRow): void {
    this.instituciones = this.instituciones.filter(x => x !== row);
  }

  // =========================
  // Impacto
  // =========================
  buscarResponsableImpacto(): void {
    // simulado (con backend: buscar por texto)
    const q = String(this.form.get('impacto.impactoResponsableSearch')?.value ?? '').trim();
    console.log('Buscar responsable impacto:', q);
  }

  // =========================
  // Guardar general
  // =========================
  guardar(): void {
    // REGLAS mínimas como el formulario real:
    // - Debe existir 1 unidad
    // - Debe existir >= 1 responsable
    if (this.unidades.length === 0) {
      this.form.markAllAsTouched();
      console.warn('Falta Unidad.');
      return;
    }
    if (this.responsables.length === 0) {
      this.form.markAllAsTouched();
      console.warn('Falta Responsable.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      ...this.form.value,
      unidades: this.unidades,
      responsables: this.responsables,
      equipoTrabajo: this.equipoTrabajo,
      financiamientos: this.financiamientos,
      centrosCosto: this.centrosCosto,
      instituciones: this.instituciones,

      evidenciasFiles: {
        asistencia: this.asistenciaFile,
        documentos: this.documentosFile,
        fotos: this.fotosFile,
      },
    };

    
    console.log('GRABAR (payload):', payload);
  }

  limpiar(): void {
    this.unidades = [];
    this.responsables = [];
    this.financiamientos = [];
    this.centrosCosto = [];
    this.instituciones = [];
    this.asistenciaFile = null; this.asistenciaFileName = '';
    this.documentosFile = null; this.documentosFileName = '';
    this.fotosFile = null; this.fotosFileName = '';


    // vuelve a setear matriz participantes a 0
    const part = this.form.get('participantes') as FormGroup;
    Object.keys(part.controls).forEach(k => {
      if (k.includes('ASISTENTE__') || k.includes('EXPOSITOR__')) part.get(k)?.setValue(0);
    });

    this.form.reset({
      proyecto: {
        unidadSearch: '',
        responsableRut: '',
        responsableNombre: '',
        responsableTipo: 'INTERNO',

        nombre: '',
        objetivo: '',
        descripcion: '',
        tipoVinculacion: '',
        areaVinculacion: '',
        areaImpacto: 'SELECCIONE',
        fechaInicio: '',
        fechaTermino: '',
        sede: '',
        lugar: '',
        ingresos: 0,
        proyectoAsociado: 'SELECCIONE',
        resultados: '',
      },

      evidencias: {
        listaAsistenciaRef: '',
        documentosRef: '',
        fotosRef: '',
        enlaceNoticia: '',
        observaciones: '',
      },


      equipoTrabajo: { equipoFiltro: 'TODOS' },
      financiamiento: { finTipo: '', finMonto: 0, ccTipo: '', ccCodigo: '', ccNombre: '' },
      difusion: { difusionEquipo: 'TODOS', difusionUrl: '' },
      participantes: { instTipo: 'CONVENIO', instNombre: '' },
      impacto: { impactoResponsableSearch: '', medidaImpacto: 'NO APLICA', indicadorImpacto: '', interpretacion: '' }
    });

    this.aplicarFiltroEquipo();
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}
