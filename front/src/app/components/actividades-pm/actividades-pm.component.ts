import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';

import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import { MatOptionModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { ActividadesPmService } from '../../services/actividades-pm.service';

type UnidadRow = { cod: string; unidad: string };
type ResponsableRow = { rut: string; nombre: string; tipo: string };
type EquipoRow = { rut: string; nombre: string; tipo: string };
type FinRow = { categoria: string; tipoFinanciamiento: string; monto: number };
type CentroCostoRow = { tipo: string };
type InstRow = { tipo: string; nombre: string };
type DifusionRow = { medio: string; url: string };

type EstudianteRow = { rut?: string; nombre?: string };

type TipoActividad =
  | 'FERIA_VOCACIONAL'
  | 'JORNADA_PEDAGOGICA'
  | 'TALLER_REMEDIAL'
  | 'CONGRESO_ACADEMICO'
  | 'ALTERNANCIA_PEDAGOGICA'
  | 'SALIDA_A_TERRENO';

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
    MatOptionModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './actividades-pm.component.html',
  styleUrls: ['./actividades-pm.component.scss'],
})
export class ActividadesPmComponent implements OnInit {
  form!: FormGroup;
  selectedTabIndex = 0;
  private readonly draftKey = 'actividad_pm_draft_v1';
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  @ViewChild('dialogOk') dialogOk!: TemplateRef<any>;


  unidades: UnidadRow[] = [];
  responsables: ResponsableRow[] = [];
  equipoTrabajo: EquipoRow[] = [];
  financiamientos: FinRow[] = [];
  centrosCosto: CentroCostoRow[] = [];
  instituciones: InstRow[] = [];
  difusiones: DifusionRow[] = [];

  estudiantesFeria: EstudianteRow[] = [];
  estudiantesSalida: EstudianteRow[] = [];

  unidadCols = ['n', 'cod', 'unidad', 'accion'];
  responsableCols = ['n', 'rut', 'nombre', 'tipo', 'accion'];
  equipoCols = ['n', 'rut', 'nombre', 'tipo', 'accion'];
  finCols = ['n', 'categoria', 'tipoFinanciamiento', 'monto', 'accion'];
  ccCols = ['n', 'tipo', 'accion'];
  instCols = ['n', 'tipo', 'nombre', 'accion'];
  difusionCols = ['n', 'medio', 'url', 'accion'];
  estudianteCols = ['n', 'rut', 'nombre', 'accion'];

  tiposResponsable = ['Académicos', 'Funcionarios', 'Jefe de carrera', 'Director de departamento', 'Externo'];
  tiposVinculacion = ['Extensión (unidireccional)', 'VcM (bidireccional)'];
  areasVinculacion = ['Docencia de pregrado', 'Comunidad educativa', 'Educación continua', 'Institucional y entidades externas', 'Integración cultural y desarrollo social', 'Investigación e innovación'];
  areasImpacto = ['SELECCIONE', 'Desarrollo social y comunitario', 'Fortalecimiento educativo y formativo', 'Cultural y patrimonio', 'Educación regional'];
  sedes = ['CASA MATRIZ ARICA', 'SEDE IQUIQUE'];
  proyectos = ['SELECCIONE', 'PLAN DE MEJORA', 'PRACTICAS', 'OTRO'];

  equiposCatalogo = [
    'DOCENTES (UTA)',
    'ESTUDIANTES (UTA)',
    'EXALUMNOS',
    'FUNCIONARIOS DE GESTIÓN (UTA)',
    'OTROS (EXTERNOS)',
  ];

  institucionesCatalogo = [
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
    'OTRO',
  ];

  participantesColumnas = [
    'DIRECTIVOS (UTA)',
    'DOCENTES (UTA)',
    'ESTUDIANTES (UTA)',
    'FUNCIONARIOS DE GESTIÓN (UTA)',
    'EXALUMNOS',
    'OTROS (EXTERNOS)',
  ];

  medidasImpacto = ['ENCUESTA'];

  tipoActividadCatalogo: { value: TipoActividad; label: string }[] = [
    { value: 'FERIA_VOCACIONAL', label: 'Feria Vocacional' },
    { value: 'JORNADA_PEDAGOGICA', label: 'Jornada Pedagógica' },
    { value: 'TALLER_REMEDIAL', label: 'Taller Remedial' },
    { value: 'CONGRESO_ACADEMICO', label: 'Congreso Académico' },
    { value: 'ALTERNANCIA_PEDAGOGICA', label: 'Alternancia Pedagógica' },
    { value: 'SALIDA_A_TERRENO', label: 'Salida a Terreno' },
  ];

  asistenciaFile: File[] = [];
  documentosFile: File[] = [];
  fotosFile: File[] = [];

  asistenciaFileName = '';
  documentosFileName = '';
  fotosFileName = '';

  showUnidadError = false;

  constructor(
    private fb: FormBuilder,
    private actividadesPmService: ActividadesPmService,
    private dialog: MatDialog,
  ) {}


  ngOnInit(): void {
    this.form = this.fb.group({
      proyecto: this.fb.group({
        responsableRut: [''],
        unidadCod: [''],
        unidadNombre: [''],
        responsableNombre: [''],
        responsableTipo: ['Académicos'],

        nombre: ['', [Validators.required, Validators.maxLength(200)]],
        objetivo: ['', [Validators.required, Validators.maxLength(400)]],
        descripcion: ['', [Validators.required, Validators.maxLength(1000)]],
        tipoVinculacion: ['', Validators.required],
        tipoVinculacionOtro: [{ value: '', disabled: true }],
        areaVinculacion: ['', Validators.required],
        areaImpacto: ['SELECCIONE', [Validators.required, this.noSeleccioneValidator(['SELECCIONE'])]],

        fechaInicio: ['', Validators.required],
        fechaTermino: ['', Validators.required],
        sede: ['', Validators.required],
        lugar: [''],
        proyectoAsociado: ['SELECCIONE', this.noSeleccioneValidator(['SELECCIONE'])],
        resultados: ['', [Validators.maxLength(1000)]],

        tipoActividad: [null, Validators.required],

        feriaInstitucionVisitada: [''],
        feriaEstRut: [''],
        feriaEstNombre: [''],

        jornadaTemaCentral: [''],
        jornadaTalleres: [''],
        jornadaResponsableTaller: [''],

        tallerAsignatura: [''],
        tallerCompetencia: [''],
        tallerNombreEstudiantesBeneficiados: [''],

        congresoNombreEvento: [''],
        congresoPonenciaPresentada: [''],
        congresoRelator: [''],

        alternanciaColegioAsociado: [''],
        alternanciaDocenteColaborador: [''],
        alternanciaAsignatura: [''],
        alternanciaCurso: [''],
        alternanciaDocenteAsignatura: [''],
        alternanciaEstudiantesParticipantes: [''],
        alternanciaNombreActividad: [''],

        salidaObjetivoPedagogico: [''],
        salidaAsignaturaVinculada: [''],
        salidaProfesorResponsable: [''],
        salidaEstRut: [''],
        salidaEstNombre: [''],
      },
      { validators: [this.fechaRangoValidator('fechaInicio', 'fechaTermino')] },
    ),

      equipoTrabajo: this.fb.group({
        rut: ['', [Validators.required, this.rutValidator()]],
        nombre: ['', [Validators.required, Validators.maxLength(120)]],
        tipo: ['', Validators.required],
      }),

      evidencias: this.fb.group({
        listaAsistenciaRef: [''],
        documentosRef: [''],
        fotosRef: [''],
        enlaceNoticia: [''],
        observaciones: [''],
      }),

      financiamiento: this.fb.group({
        finCategoria: [''],
        finTipoFinanciamiento: [''],
        finMonto: [0],
        ccTipo: [''],
      }),

      participantes: this.fb.group({
        instTipo: ['INSTITUCIÓN EXTERNA', Validators.required],
        instNombre: ['', [Validators.required, Validators.maxLength(150)]],
        ...this.buildParticipantesControls(),
      }),

      impacto: this.fb.group({
        medidaImpacto: ['ENCUESTA', Validators.required],
        indicadorImpacto: ['', Validators.required],
      }),

      difusion: this.fb.group({
        difusionEquipo: ['SELECCIONE'],
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

    this.fProy('tipoActividad').valueChanges.subscribe((t: TipoActividad) => {
      this.aplicarValidadoresTipoActividad(t);
    });

    const initial = this.fProy('tipoActividad').value as TipoActividad;
    this.aplicarValidadoresTipoActividad(initial);
    this.updateEquipoValidators();
    this.updateInstitucionValidators();

    this.fProy('unidadCod')
      .valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => {
          const codigo = String(value ?? '').trim();
          if (!codigo) return of(null);
          return this.actividadesPmService.obtenerUnidadPorCodigo(codigo).pipe(
            catchError(() => of(null)),
          );
        }),
      )
      .subscribe((unidad) => {
        if (unidad?.nombre) {
          this.fProy('unidadNombre').setValue(unidad.nombre, { emitEvent: false });
        }
      });

    this.fProy('responsableRut')
      .valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => {
          const rut = String(value ?? '').trim();
          if (!rut || !this.isRutFormatOk(rut)) return of(null);
          return this.actividadesPmService.obtenerResponsablePorRut(rut).pipe(
            catchError(() => of(null)),
          );
        }),
      )
      .subscribe((resp) => {
        if (resp?.nombre) {
          this.fProy('responsableNombre').setValue(resp.nombre, { emitEvent: false });
        }
      });

    this.fEq('rut')
      .valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => {
          const rut = String(value ?? '').trim();
          if (!rut || !this.isRutFormatOk(rut)) return of(null);
          return this.actividadesPmService.obtenerEquipoTrabajoPorRut(rut).pipe(
            catchError(() => of(null)),
          );
        }),
      )
      .subscribe((equipo) => {
        if (equipo?.nombre) {
          this.fEq('nombre').setValue(equipo.nombre, { emitEvent: false });
        }
      });

    this.loadDraft();

    this.form.valueChanges.pipe(debounceTime(500)).subscribe(() => {
      this.scheduleDraftSave();
    });
  }

  fProy(name: string) {
    return (this.form.get('proyecto') as FormGroup).get(name)!;
  }

  fImp(name: string) {
    return (this.form.get('impacto') as FormGroup).get(name)!;
  }

  fEq(name: string) {
    return (this.form.get('equipoTrabajo') as FormGroup).get(name)!;
  }

  private aplicarValidadoresTipoActividad(t?: TipoActividad | null) {
    const allSpecific = [
      'feriaInstitucionVisitada',

      'jornadaTemaCentral',
      'jornadaTalleres',
      'jornadaResponsableTaller',

      'tallerAsignatura',
      'tallerCompetencia',
      'tallerNombreEstudiantesBeneficiados',

      'congresoNombreEvento',
      'congresoPonenciaPresentada',
      'congresoRelator',

      'alternanciaColegioAsociado',
      'alternanciaDocenteColaborador',
      'alternanciaAsignatura',
      'alternanciaCurso',
      'alternanciaDocenteAsignatura',
      'alternanciaEstudiantesParticipantes',
      'alternanciaNombreActividad',

      'salidaObjetivoPedagogico',
      'salidaAsignaturaVinculada',
      'salidaProfesorResponsable',
    ];

    for (const k of allSpecific) {
      const c = this.fProy(k);
      c.clearValidators();
      c.updateValueAndValidity({ emitEvent: false });
    }

    if (!t) return;

    const reqText = (k: string, max = 250) => this.setReq(k, [Validators.required, Validators.maxLength(max)]);
    const reqNum = (k: string) => this.setReq(k, [Validators.required, Validators.min(0)]);

    if (t === 'FERIA_VOCACIONAL') {
      reqText('feriaInstitucionVisitada', 200);
    }

    if (t === 'JORNADA_PEDAGOGICA') {
      reqText('jornadaTemaCentral', 250);
      reqText('jornadaTalleres', 250);
      reqText('jornadaResponsableTaller', 200);
    }

    if (t === 'TALLER_REMEDIAL') {
      reqText('tallerAsignatura', 200);
      reqText('tallerCompetencia', 250);
      reqNum('tallerNombreEstudiantesBeneficiados');
    }

    if (t === 'CONGRESO_ACADEMICO') {
      reqText('congresoNombreEvento', 250);
      reqText('congresoPonenciaPresentada', 250);
      reqText('congresoRelator', 200);
    }

    if (t === 'ALTERNANCIA_PEDAGOGICA') {
      reqText('alternanciaColegioAsociado', 250);
      reqText('alternanciaDocenteColaborador', 200);
      reqText('alternanciaAsignatura', 200);
      reqText('alternanciaCurso', 80);
      reqText('alternanciaDocenteAsignatura', 200);
      reqText('alternanciaEstudiantesParticipantes', 250);
      reqText('alternanciaNombreActividad', 250);
    }

    if (t === 'SALIDA_A_TERRENO') {
      reqText('salidaObjetivoPedagogico', 300);
      reqText('salidaAsignaturaVinculada', 200);
      reqText('salidaProfesorResponsable', 200);
    }
  }

  private setReq(key: string, validators: any[]) {
    const c = this.fProy(key);
    c.setValidators(validators);
    c.updateValueAndValidity({ emitEvent: false });
  }

  addUnidad(): void {
    const cod = String(this.fProy('unidadCod').value ?? '').trim();
    const unidad = String(this.fProy('unidadNombre').value ?? '').trim();
    if (!cod || !unidad) return;

    const exists = this.unidades.some((u) => u.cod.toLowerCase() === cod.toLowerCase());
    if (exists) return;

    this.unidades = [...this.unidades, { cod, unidad }];
    this.showUnidadError = false;
    this.fProy('unidadCod').setValue('');
    this.fProy('unidadNombre').setValue('');
    this.scheduleDraftSave();
  }

  removeUnidad(row: UnidadRow): void {
    this.unidades = this.unidades.filter((x) => x !== row);
    this.scheduleDraftSave();
  }

  addResponsable(): void {
    const rut = String(this.fProy('responsableRut').value ?? '').trim();
    const nombre = String(this.fProy('responsableNombre').value ?? '').trim();
    const tipo = String(this.fProy('responsableTipo').value ?? 'Académicos');

    if (!rut || !nombre) return;

    this.responsables = [...this.responsables, { rut, nombre, tipo }];

    this.fProy('responsableRut').setValue('');
    this.fProy('responsableNombre').setValue('');
    this.fProy('responsableTipo').setValue('Académicos');
    this.scheduleDraftSave();
  }

  removeResponsable(row: ResponsableRow): void {
    this.responsables = this.responsables.filter((x) => x !== row);
    this.scheduleDraftSave();
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
    const exists = this.equipoTrabajo.some((x) => x.rut.toLowerCase() === rut.toLowerCase());
    if (exists) return;

    this.equipoTrabajo = [...this.equipoTrabajo, { rut, nombre, tipo }];
    g.reset({ rut: '', nombre: '', tipo: '' });
    g.markAsPristine();
    g.markAsUntouched();
    this.updateEquipoValidators();
    this.scheduleDraftSave();
  }

  removeEquipo(row: EquipoRow): void {
    this.equipoTrabajo = this.equipoTrabajo.filter((x) => x !== row);
    this.updateEquipoValidators();
    this.scheduleDraftSave();
  }

  onRutInputEquipo(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const formatted = this.formatRut(input.value);
    if (formatted !== this.fEq('rut').value) {
      this.fEq('rut').setValue(formatted, { emitEvent: true });
    }
  }

  onRutInputResponsable(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const formatted = this.formatRut(input.value);
    if (formatted !== this.fProy('responsableRut').value) {
      this.fProy('responsableRut').setValue(formatted, { emitEvent: true });
    }
  }

  onRutInputFeria(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const formatted = this.formatRut(input.value);
    this.fProy('feriaEstRut').setValue(formatted, { emitEvent: false });
  }

  onRutInputSalida(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const formatted = this.formatRut(input.value);
    this.fProy('salidaEstRut').setValue(formatted, { emitEvent: false });
  }

  addEstudianteFeria(): void {
    const rutRaw = String(this.fProy('feriaEstRut').value ?? '').trim();
    const nombre = String(this.fProy('feriaEstNombre').value ?? '').trim();

    if (!rutRaw && !nombre) return;

    const rut = rutRaw ? this.formatRut(rutRaw) : '';
    if (rut && !this.isRutFormatOk(rut)) return;

    const exists = rut ? this.estudiantesFeria.some((x) => (x.rut ?? '').toLowerCase() === rut.toLowerCase()) : false;
    if (exists) return;

    this.estudiantesFeria = [...this.estudiantesFeria, { rut: rut || undefined, nombre: nombre || undefined }];

    this.fProy('feriaEstRut').setValue('');
    this.fProy('feriaEstNombre').setValue('');
    this.scheduleDraftSave();
  }

  removeEstudianteFeria(row: EstudianteRow): void {
    this.estudiantesFeria = this.estudiantesFeria.filter((x) => x !== row);
    this.scheduleDraftSave();
  }

  addEstudianteSalida(): void {
    const rutRaw = String(this.fProy('salidaEstRut').value ?? '').trim();
    const nombre = String(this.fProy('salidaEstNombre').value ?? '').trim();

    if (!rutRaw && !nombre) return;

    const rut = rutRaw ? this.formatRut(rutRaw) : '';
    if (rut && !this.isRutFormatOk(rut)) return;

    const exists = rut ? this.estudiantesSalida.some((x) => (x.rut ?? '').toLowerCase() === rut.toLowerCase()) : false;
    if (exists) return;

    this.estudiantesSalida = [...this.estudiantesSalida, { rut: rut || undefined, nombre: nombre || undefined }];

    this.fProy('salidaEstRut').setValue('');
    this.fProy('salidaEstNombre').setValue('');
    this.scheduleDraftSave();
  }

  removeEstudianteSalida(row: EstudianteRow): void {
    this.estudiantesSalida = this.estudiantesSalida.filter((x) => x !== row);
    this.scheduleDraftSave();
  }

  private isRutFormatOk(v: string): boolean {
    return /^\d{1,2}(\.\d{3}){2}-[0-9K]$/i.test(v);
  }

  private formatRut(value: string): string {
    const clean = value.toUpperCase().replace(/[^0-9K]/g, '');
    if (clean.length < 2) return clean;

    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${withDots}-${dv}`;
  }

  private validarDvRut(rut: string): boolean {
    const clean = rut.replace(/\./g, '').replace('-', '').toUpperCase();
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);

    let sum = 0;
    let mul = 2;

    for (let i = body.length - 1; i >= 0; i--) {
      sum += Number(body[i]) * mul;
      mul = mul === 7 ? 2 : mul + 1;
    }

    const res = 11 - (sum % 11);
    const dvEsperado = res === 11 ? '0' : res === 10 ? 'K' : String(res);

    return dv === dvEsperado;
  }


  private rutValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const v = String(control.value ?? '').trim();
      if (!v) return null;

      const okFormat = /^\d{1,2}(\.\d{3}){2}-[0-9K]$/i.test(v);
      if (!okFormat) return { rut: true };

      if (!this.validarDvRut(v)) return { rutDv: true };

      return null;
    };
  }

  private fechaRangoValidator(startKey: string, endKey: string) {
    return (control: AbstractControl): ValidationErrors | null => {
      const g = control as FormGroup;
      const start = g.get(startKey)?.value;
      const end = g.get(endKey)?.value;

      if (!start || !end) return null;

      const d1 = new Date(start);
      const d2 = new Date(end);

      if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;

      return d1 <= d2 ? null : { fechaRango: true };
    };
  }

  private noSeleccioneValidator(invalidValues: string[] = ['SELECCIONE']) {
    return (control: AbstractControl): ValidationErrors | null => {
      const v = String(control.value ?? '').trim();
      if (!v) return { required: true };
      if (invalidValues.includes(v)) return { noSeleccione: true };
      return null;
    };
  }

  addFinanciamiento(): void {
    const g = this.form.get('financiamiento') as FormGroup;
    const categoria = g.get('finCategoria')?.value;
    const tipoFinanciamiento = g.get('finTipoFinanciamiento')?.value;
    const monto = Number(g.get('finMonto')?.value ?? 0);
    
    console.log('Categoría:', categoria, 'Tipo de financiamiento:', tipoFinanciamiento, 'Monto:', monto);
    
    if (!categoria || !tipoFinanciamiento) {
      alert('Por favor completa los campos Categoría y Tipo de financiamiento');
      return;
    }

    this.financiamientos = [...this.financiamientos, { categoria, tipoFinanciamiento, monto: isNaN(monto) ? 0 : monto }];
    g.get('finCategoria')?.setValue('');
    g.get('finTipoFinanciamiento')?.setValue('');
    g.get('finMonto')?.setValue(0);
    g.markAsPristine();
    g.markAsUntouched();
    this.scheduleDraftSave();
  }

  removeFin(row: FinRow): void {
    this.financiamientos = this.financiamientos.filter((x) => x !== row);
    this.scheduleDraftSave();
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
    this.scheduleDraftSave();
  }

  removeCC(row: CentroCostoRow): void {
    this.centrosCosto = this.centrosCosto.filter((x) => x !== row);
    this.scheduleDraftSave();
  }

  onFileSelected(event: Event, tipo: 'asistencia' | 'documentos' | 'fotos'): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;

    const maxMb = 10;
    const allow = {
      asistencia: ['pdf', 'xls', 'xlsx'],
      documentos: ['pdf', 'xls', 'xlsx'],
      fotos: ['jpg', 'jpeg', 'png'],
    }[tipo];

    const validFiles = files.filter((file) => {
      const sizeOk = file.size <= maxMb * 1024 * 1024;
      const ext = (file.name.split('.').pop() ?? '').toLowerCase();
      return allow.includes(ext) && sizeOk;
    });

    if (!validFiles.length) {
      input.value = '';
      return;
    }

    if (tipo == 'asistencia') {
      this.asistenciaFile = validFiles;
      this.asistenciaFileName = this.formatFileNames(validFiles);
    } else if (tipo == 'documentos') {
      this.documentosFile = validFiles;
      this.documentosFileName = this.formatFileNames(validFiles);
    } else {
      this.fotosFile = validFiles;
      this.fotosFileName = this.formatFileNames(validFiles);
    }
    this.scheduleDraftSave();
  }

  private formatFileNames(files: File[]): string {
    const names = files.map((f) => f.name).filter((n) => n);
    if (!names.length) return '';
    if (names.length <= 2) return names.join(', ');
    return `${names[0]}, ${names[1]} (+${names.length - 2} mas)`;
  }

  private scheduleDraftSave(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.saveDraft(), 400);
  }

  private saveDraft(): void {
    if (!this.form) return;
    const draft = {
      form: this.form.getRawValue(),
      unidades: this.unidades,
      responsables: this.responsables,
      equipoTrabajo: this.equipoTrabajo,
      financiamientos: this.financiamientos,
      centrosCosto: this.centrosCosto,
      instituciones: this.instituciones,
      difusiones: this.difusiones,
      estudiantesFeria: this.estudiantesFeria,
      estudiantesSalida: this.estudiantesSalida,
      selectedTabIndex: this.selectedTabIndex,
      files: {
        asistenciaFileName: this.asistenciaFileName,
        documentosFileName: this.documentosFileName,
        fotosFileName: this.fotosFileName,
      },
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(this.draftKey, JSON.stringify(draft));
    } catch {
      // ignore storage errors
    }
  }

  private loadDraft(): void {
    try {
      const raw = localStorage.getItem(this.draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.form) this.form.patchValue(draft.form);
      this.unidades = draft?.unidades ?? [];
      this.responsables = draft?.responsables ?? [];
      this.equipoTrabajo = draft?.equipoTrabajo ?? [];
      this.financiamientos = draft?.financiamientos ?? [];
      this.centrosCosto = draft?.centrosCosto ?? [];
      this.instituciones = draft?.instituciones ?? [];
      this.difusiones = draft?.difusiones ?? [];
      this.estudiantesFeria = draft?.estudiantesFeria ?? [];
      this.estudiantesSalida = draft?.estudiantesSalida ?? [];
      this.selectedTabIndex = draft?.selectedTabIndex ?? this.selectedTabIndex;
      this.asistenciaFileName = draft?.files?.asistenciaFileName ?? '';
      this.documentosFileName = draft?.files?.documentosFileName ?? '';
      this.fotosFileName = draft?.files?.fotosFileName ?? '';
      this.updateEquipoValidators();
      this.updateInstitucionValidators();
    } catch {
      // ignore parse errors
    }
  }

  private clearDraft(): void {
    try {
      localStorage.removeItem(this.draftKey);
    } catch {
      // ignore storage errors
    }
  }

  private urlOptionalValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const v = String(control.value ?? '').trim();
      if (!v) return null;
      const ok = /^https?:\/\/.+/i.test(v);
      return ok ? null : { url: true };
    };
  }

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
    return `${tipo}__${col}`.replace(/\s+/g, '_').replace(/[()]/g, '');
  }

  grabarParticipantes(): void {
    const g = this.form.get('participantes') as FormGroup;
    console.log('Participantes (matriz):', g.value);
  }

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
    this.updateInstitucionValidators();
    this.scheduleDraftSave();
  }

  removeInstitucion(row: InstRow): void {
    this.instituciones = this.instituciones.filter((x) => x !== row);
    this.updateInstitucionValidators();
    this.scheduleDraftSave();
  }

  editResponsable(row: ResponsableRow): void {
    this.fProy('responsableRut').setValue(row.rut);
    this.fProy('responsableNombre').setValue(row.nombre);
    this.fProy('responsableTipo').setValue(row.tipo);
    this.removeResponsable(row);
  }

  editUnidad(row: UnidadRow): void {
    this.fProy('unidadCod').setValue(row.cod);
    this.fProy('unidadNombre').setValue(row.unidad);
    this.removeUnidad(row);
  }

  editEquipo(row: EquipoRow): void {
    const g = this.form.get('equipoTrabajo') as FormGroup;
    g.get('rut')?.setValue(row.rut);
    g.get('nombre')?.setValue(row.nombre);
    g.get('tipo')?.setValue(row.tipo);
    this.removeEquipo(row);
  }

  editFinanciamiento(row: FinRow): void {
    const g = this.form.get('financiamiento') as FormGroup;
    g.get('finCategoria')?.setValue(row.categoria);
    g.get('finTipoFinanciamiento')?.setValue(row.tipoFinanciamiento);
    g.get('finMonto')?.setValue(row.monto);
    this.removeFin(row);
  }

  editCentroCosto(row: CentroCostoRow): void {
    const g = this.form.get('financiamiento') as FormGroup;
    g.get('ccTipo')?.setValue(row.tipo);
    this.removeCC(row);
  }

  editInstitucion(row: InstRow): void {
    const g = this.form.get('participantes') as FormGroup;
    g.get('instTipo')?.setValue(row.tipo);
    g.get('instNombre')?.setValue(row.nombre);
    this.removeInstitucion(row);
  }

  addDifusion(): void {
    const g = this.form.get('difusion') as FormGroup;
    const medio = String(g.get('difusionEquipo')?.value ?? '').trim();
    const url = String(g.get('difusionUrl')?.value ?? '').trim();

    if (!medio || medio === 'SELECCIONE') {
      alert('Por favor selecciona un medio de difusión');
      return;
    }


    this.difusiones = [...this.difusiones, { medio, url }];
    g.get('difusionEquipo')?.setValue('SELECCIONE');
    g.get('difusionUrl')?.setValue('');
    g.markAsPristine();
    g.markAsUntouched();
    this.scheduleDraftSave();
  }

  removeDifusion(row: DifusionRow): void {
    this.difusiones = this.difusiones.filter((x) => x !== row);
    this.scheduleDraftSave();
  }

  editDifusion(row: DifusionRow): void {
    const g = this.form.get('difusion') as FormGroup;
    g.get('difusionEquipo')?.setValue(row.medio);
    g.get('difusionUrl')?.setValue(row.url);
    this.removeDifusion(row);
  }

  guardar(): void {
    if (this.unidades.length === 0) {
      this.form.markAllAsTouched();
      this.showUnidadError = true;
      this.goToSection('sec-unidades', 0);
      return;
    }
    if (this.responsables.length === 0) {
      this.form.markAllAsTouched();
      this.goToSection('sec-responsables', 0);
      return;
    }
    if (this.equipoTrabajo.length === 0) {
      this.form.markAllAsTouched();
      this.goToSection('sec-equipo', 2);
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    const estudiantes = [...this.estudiantesFeria, ...this.estudiantesSalida];

    const request = {
      payload: {
        proyecto: this.form.value.proyecto,
        evidencias: this.form.value.evidencias,
        participantes: this.form.value.participantes,
        impacto: this.form.value.impacto,
        difusion: this.form.value.difusion,
      },
      unidades: this.unidades,
      responsables: this.responsables,
      equipoTrabajo: this.equipoTrabajo,
      financiamientos: this.financiamientos,
      centrosCosto: this.centrosCosto,
      difusiones: this.difusiones,
      instituciones: this.instituciones,
      estudiantes,
      files: {
        asistencia: this.asistenciaFile,
        documentos: this.documentosFile,
        fotos: this.fotosFile,
      },
    };

    this.actividadesPmService.crear(request).subscribe({
      next: (res) => {
        const id = Number(res?.id ?? 0);
        if (!Number.isFinite(id) || id <= 0) {
          this.openDialog(false, 'No se pudo registrar la actividad de vinculacion. Intenta nuevamente.');
          return;
        }
        const medios = this.difusiones?.length
          ? ` (Medio: ${this.difusiones.map((d) => d.medio).join(', ')})`
          : '';

        this.openDialog(true, `Actividad de vinculacion registrada exitosamente.${medios}`);
        this.limpiar();
      },
      error: (err) => {
        console.error('Error guardando actividad', err);
        const apiMessage = err?.error?.message || err?.message;
        const fallback = 'No se pudo registrar la actividad de vinculacion. Intenta nuevamente.';
        this.openDialog(false, apiMessage || fallback);
      },
    });

  }

  private goToSection(id: string, tabIndex: number) {
    this.selectedTabIndex = tabIndex;
    this.scheduleDraftSave();
    setTimeout(() => {
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  private focusFirstInvalid() {
    const selector =
      'form .ng-invalid[formcontrolname], form .ng-invalid input, form .ng-invalid select, form .ng-invalid textarea';
    const invalid = document.querySelector(selector) as HTMLElement | null;
    if (!invalid) return;

    const tabBody = invalid.closest('[data-tab]') as HTMLElement | null;
    if (tabBody) {
      const idx = Number(tabBody.getAttribute('data-tab'));
      if (!Number.isNaN(idx)) this.selectedTabIndex = idx;
    }

    setTimeout(() => {
      invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof invalid.focus === 'function') invalid.focus();
    }, 0);
  }

  closeDialogOk(): void {
    this.dialog.closeAll();
  }

  private openDialog(success: boolean, message: string): void {
    this.dialog.open(this.dialogOk, {
      data: { message, success },
      disableClose: !success,
      autoFocus: false,
      panelClass: 'ok-dialog',
    });
  }


  limpiar(): void {
    this.unidades = [];
    this.responsables = [];
    this.equipoTrabajo = [];
    this.financiamientos = [];
    this.centrosCosto = [];
    this.instituciones = [];
    this.estudiantesFeria = [];
    this.estudiantesSalida = [];
    this.showUnidadError = false;

    this.asistenciaFile = [];
    this.asistenciaFileName = '';
    this.documentosFile = [];
    this.documentosFileName = '';
    this.fotosFile = [];
    this.fotosFileName = '';

    const part = this.form.get('participantes') as FormGroup;
    Object.keys(part.controls).forEach((k) => {
      if (k.includes('ASISTENTE__') || k.includes('EXPOSITOR__')) part.get(k)?.setValue(0);
    });

    this.form.reset({
      proyecto: {
        unidadCod: '',
        unidadNombre: '',
        responsableRut: '',
        responsableNombre: '',
        tipoVinculacionOtro: '',
        responsableTipo: 'Académicos',
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
        proyectoAsociado: 'SELECCIONE',
        resultados: '',
        tipoActividad: null,

        feriaInstitucionVisitada: '',
        feriaEstRut: '',
        feriaEstNombre: '',

        jornadaTemaCentral: '',
        jornadaTalleres: '',
        jornadaResponsableTaller: '',

        tallerAsignatura: '',
        tallerCompetencia: '',
        tallerNombreEstudiantesBeneficiados: 0,

        congresoNombreEvento: '',
        congresoPonenciaPresentada: '',
        congresoRelator: '',

        alternanciaColegioAsociado: '',
        alternanciaDocenteColaborador: '',
        alternanciaAsignatura: '',
        alternanciaCurso: '',
        alternanciaDocenteAsignatura: '',
        alternanciaEstudiantesParticipantes: '',
        alternanciaNombreActividad: '',

        salidaObjetivoPedagogico: '',
        salidaAsignaturaVinculada: '',
        salidaProfesorResponsable: '',
        salidaEstRut: '',
        salidaEstNombre: '',
      },
      evidencias: {
        listaAsistenciaRef: '',
        documentosRef: '',
        fotosRef: '',
        enlaceNoticia: '',
        observaciones: '',
      },
      equipoTrabajo: { rut: '', nombre: '', tipo: '' },
      financiamiento: { finCategoria: '', finTipoFinanciamiento: '', finMonto: 0 },
      difusion: { difusionEquipo: 'SELECCIONE', difusionUrl: '' },
      participantes: { instTipo: 'INSTITUCIÓN EXTERNA', instNombre: '' },
      impacto: { medidaImpacto: 'ENCUESTA', indicadorImpacto: '' },
    });

    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.updateEquipoValidators();
    this.updateInstitucionValidators();
    this.clearDraft();
  }

  private updateEquipoValidators() {
    const g = this.form?.get('equipoTrabajo') as FormGroup | null;
    if (!g) return;

    const require = this.equipoTrabajo.length === 0;
    const rutCtrl = g.get('rut');
    const nombreCtrl = g.get('nombre');
    const tipoCtrl = g.get('tipo');

    rutCtrl?.setValidators(require ? [Validators.required, this.rutValidator()] : [this.rutValidator()]);
    nombreCtrl?.setValidators(require ? [Validators.required, Validators.maxLength(120)] : [Validators.maxLength(120)]);
    tipoCtrl?.setValidators(require ? [Validators.required] : []);

    rutCtrl?.updateValueAndValidity({ emitEvent: false });
    nombreCtrl?.updateValueAndValidity({ emitEvent: false });
    tipoCtrl?.updateValueAndValidity({ emitEvent: false });
  }

  private updateInstitucionValidators() {
    const g = this.form?.get('participantes') as FormGroup | null;
    if (!g) return;

    const require = this.instituciones.length === 0;
    const tipoCtrl = g.get('instTipo');
    const nombreCtrl = g.get('instNombre');

    tipoCtrl?.setValidators(require ? [Validators.required] : []);
    nombreCtrl?.setValidators(require ? [Validators.required, Validators.maxLength(150)] : [Validators.maxLength(150)]);

    tipoCtrl?.updateValueAndValidity({ emitEvent: false });
    nombreCtrl?.updateValueAndValidity({ emitEvent: false });
  }
}
