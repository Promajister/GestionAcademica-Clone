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
type CentroCostoRow = { tipo: string };
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
  equipoCols = ['n', 'rut', 'nombre', 'tipo', 'accion'];
  finCols = ['n', 'tipo', 'monto', 'accion'];
  ccCols = ['n', 'tipo', 'accion'];
  instCols = ['n', 'tipo', 'nombre', 'accion'];

  // catálogos (ajústalos según tu backend real)
  tiposResponsable = ['INTERNO', 'EXTERNO'];
  tiposVinculacion = ['VcM (Bidireccionales)', 'VcM (Unidireccionales)','Extencion' , 'Otro'];
  areasVinculacion = ['Educación', 'Salud', 'Cultura', 'Territorio', 'Investigación', 'Otro'];
  areasImpacto = ['SELECCIONE', 'Educación', 'Social', 'Productivo', 'Territorial', 'Otro'];
  sedes = ['CASA MATRIZ ARICA', 'SEDE IQUIQUE'];
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

  institucionesCatalogo = [
  'PACE',
  'PROPEDÉUTICO',
  'INSTITUCIÓN EXTERNA',
  'INSTITUCIÓN INTERNA',
  'CENTROS EDUCATIVOS',
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
    'FUNCIONARIOS DE GESTIÓN (UTA)',
    'EXALUMNOS',
    'OTROS (EXTERNOS)'
  ];

  medidasImpacto = ['ENCUESTA'];


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
        responsableRut: [''],
        unidadCod: [''],
        unidadNombre: [''],
        responsableNombre: [''],
        responsableTipo: ['INTERNO'],

        // campos de la actividad
        nombre: ['', [Validators.required, Validators.maxLength(200)]],
        objetivo: ['', [Validators.required, Validators.maxLength(400)]],
        descripcion: ['', [Validators.required, Validators.maxLength(1000)]],
        tipoVinculacion: ['', Validators.required],
        tipoVinculacionOtro: [{ value: '', disabled: true }],
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
        rut: ['', [Validators.required, this.rutValidator()]],
        nombre: ['', [Validators.required, Validators.maxLength(120)]],
        tipo: ['', Validators.required], // aquí irá DIRECTIVOS, DOCENTES, etc.
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
      }),

      participantes: this.fb.group({
        instTipo: ['PACE', Validators.required],
        instNombre: ['', [Validators.required, Validators.maxLength(150)]],

        // matriz
        ...this.buildParticipantesControls(),
      }),


      impacto: this.fb.group({
        medidaImpacto: ['ENCUESTA', Validators.required],
        indicadorImpacto: ['', Validators.required],
      }),


      difusion: this.fb.group({
        difusionEquipo: ['SELECCIONE', Validators.required],
        difusionUrl: ['', [this.urlOptionalValidator()]],
      }),
    });


    this.fProy('tipoVinculacion').valueChanges.subscribe((v: string) => {
  const otroCtrl = this.fProy('tipoVinculacionOtro');

  if (v === 'Otro') {
    otroCtrl.enable({ emitEvent: false });
    otroCtrl.setValidators([Validators.required, Validators.maxLength(100)]);
  } else {
    otroCtrl.reset('', { emitEvent: false });
    otroCtrl.clearValidators();
    otroCtrl.disable({ emitEvent: false });
  }

  otroCtrl.updateValueAndValidity({ emitEvent: false });
});


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
  addUnidad(): void {
    const cod = String(this.fProy('unidadCod').value ?? '').trim();
    const unidad = String(this.fProy('unidadNombre').value ?? '').trim();

    if (!cod || !unidad) return;

    // evitar duplicados por código (opcional)
    const exists = this.unidades.some(u => u.cod.toLowerCase() === cod.toLowerCase());
    if (exists) {
      console.warn('El código de unidad ya existe.');
      return;
    }

    this.unidades = [...this.unidades, { cod, unidad }];

    this.fProy('unidadCod').setValue('');
    this.fProy('unidadNombre').setValue('');
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


  fEq(name: string) {
  return (this.form.get('equipoTrabajo') as FormGroup).get(name)!;
}

  addEquipo(): void {
    const g = this.form.get('equipoTrabajo') as FormGroup;

    let rut = String(g.get('rut')?.value ?? '').trim();
    const nombre = String(g.get('nombre')?.value ?? '').trim();
    const tipo = String(g.get('tipo')?.value ?? '').trim();

    if (!rut || !nombre || !tipo) {
      g.markAllAsTouched();
      return;
    }
    if (g.invalid) {
      g.markAllAsTouched();
      return;
    }

    rut = this.formatRut(rut);

    // evitar duplicados por RUT (opcional)
    const exists = this.equipoTrabajo.some(x => x.rut.toLowerCase() === rut.toLowerCase());
    if (exists) {
      console.warn('Este RUT ya está agregado.');
      return;
    }

    this.equipoTrabajo = [...this.equipoTrabajo, { rut, nombre, tipo }];

    g.reset({ rut: '', nombre: '', tipo: '' });
    g.markAsPristine();
    g.markAsUntouched();
  }

  removeEquipo(row: EquipoRow): void {
    this.equipoTrabajo = this.equipoTrabajo.filter(x => x !== row);
  }

onRutInputEquipo(ev: Event): void {
  const input = ev.target as HTMLInputElement;
  const formatted = this.formatRut(input.value);
  this.fEq('rut').setValue(formatted, { emitEvent: false });
}

private formatRut(value: string): string {
  // deja solo 0-9 y K
  const clean = value.toUpperCase().replace(/[^0-9K]/g, '');
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  // puntos cada 3 desde el final
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${withDots}-${dv}`;
}

private rutValidator() {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = String(control.value ?? '').trim();
    if (!v) return null;

    // Formato esperado: 12.345.678-9 o 12.345.678-K
    const okFormat = /^\d{1,2}(\.\d{3}){2}-[0-9K]$/i.test(v);
    if (!okFormat) return { rut: true };

    // (Opcional) aquí podrías validar DV real si quieres
    return null;
  };
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

    if (!tipo) {
      g.get('ccTipo')?.markAsTouched();
      return;
    }

    this.centrosCosto = [...this.centrosCosto, { tipo }];

    g.get('ccTipo')?.setValue('');
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

    if (!tipo || !nombre) {
      g.markAllAsTouched();
      return;
    }

    this.instituciones = [...this.instituciones, { tipo, nombre }];

    g.get('instNombre')?.setValue('');
    g.get('instNombre')?.markAsPristine();
    g.get('instNombre')?.markAsUntouched();
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

  // 1️Debe existir al menos 1 unidad
  if (this.unidades.length === 0) {
    this.form.markAllAsTouched();
    console.warn('Falta Unidad.');
    return;
  }

  // 2️Debe existir al menos 1 responsable
  if (this.responsables.length === 0) {
    this.form.markAllAsTouched();
    console.warn('Falta Responsable.');
    return;
  }

  // 3️Debe existir al menos 1 integrante del equipo de trabajo
  if (this.equipoTrabajo.length === 0) {
    this.form.markAllAsTouched();
    console.warn('Falta Equipo de trabajo.');
    return;
  }

  // Validación general del formulario
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  // Construcción del payload
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
        unidadCod: '',
        unidadNombre: '',
        responsableRut: '',
        responsableNombre: '',
        tipoVinculacionOtro: '',
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


      equipoTrabajo: { rut: '', nombre: '', tipo: '' },
      financiamiento: { finTipo: '', finMonto: 0, ccTipo: ''},
      difusion: { difusionEquipo: 'TODOS', difusionUrl: '' },
      participantes: { instTipo: 'CONVENIO', instNombre: '' },
      impacto: { medidaImpacto: 'ENCUESTA', indicadorImpacto: ''}
    });

    this.aplicarFiltroEquipo();
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}
