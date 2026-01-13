import { Component, Inject, OnInit } from '@angular/core';
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

import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatOptionModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ActividadesPmService } from '../../services/actividades-pm.service';

export interface ActividadPmDialogData {
  id: number;
  mode: 'view' | 'edit';
}

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
  selector: 'app-actividad-pm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTableModule,
    MatOptionModule,
    MatTooltipModule,
  ],
  templateUrl: './actividad-pm-dialog.component.html',
  styleUrls: ['./actividad-pm-dialog.component.scss'],
})
export class ActividadPmDialogComponent implements OnInit {
  loading = true;
  saving = false;
  errorMsg = '';

  actividad: any = null;

  form!: FormGroup;
  selectedTabIndex = 0;

  unidades: UnidadRow[] = [];
  responsables: ResponsableRow[] = [];
  equipoTrabajo: EquipoRow[] = [];
  financiamientos: FinRow[] = [];
  centrosCosto: CentroCostoRow[] = [];
  instituciones: InstRow[] = [];
  difusiones: DifusionRow[] = [];
  estudiantesFeria: EstudianteRow[] = [];
  estudiantesSalida: EstudianteRow[] = [];

  unidadCols: string[] = [];
  responsableCols: string[] = [];
  equipoCols: string[] = [];
  finCols: string[] = [];
  ccCols: string[] = [];
  instCols: string[] = [];
  difusionCols: string[] = [];
  estudianteCols: string[] = [];

  tiposResponsable = ['Académicos', 'Funcionarios', 'Jefe de carrera', 'Director de departamento', 'Externo'];

  tiposVinculacion = ['Extensión (unidireccional)', 'VcM (bidireccional)'];

  areasVinculacion = [
    'Docencia de pregrado',
    'Comunidad educativa',
    'Educación continua',
    'Institucional y entidades externas',
    'Integración cultural y desarrollo social',
    'Investigación e innovación',
  ];
  areasImpacto = [
    'SELECCIONE',
    'Desarrollo social y comunitario',
    'Fortalecimiento educativo y formativo',
    'Cultural y patrimonio',
    'Educación regional',
  ];
  sedes = ['CASA MATRIZ ARICA', 'SEDE IQUIQUE'];
  proyectos = ['SELECCIONE', 'PLAN DE MEJORA', 'PRACTICAS', 'OTRO'];

  equiposCatalogo = [
    'DOCENTES (UTA)',
    'ESTUDIANTES (UTA)',
    'EXALUMNOS',
    'FUNCIONARIOS DE GESTIÓN (UTA)',
    'OTROS (EXTERNOS)',
  ];

  institucionesCatalogo = ['INSTITUCIÓN EXTERNA', 'INSTITUCIÓN INTERNA', 'CENTROS EDUCATIVOS'];

  difusionCatalogo = ['SELECCIONE', 'TODOS', 'MEDIOS DIG. REDES SO', 'PRENSA ESCRITA', 'RADIO', 'TELEVISIÓN', 'OTRO'];

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

  asistenciaFile: File | null = null;
  documentosFile: File | null = null;
  fotosFile: File | null = null;

  asistenciaFileName = '';
  documentosFileName = '';
  fotosFileName = '';

  showUnidadError = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ActividadPmDialogData,
    private dialogRef: MatDialogRef<ActividadPmDialogComponent>,
    private fb: FormBuilder,
    private api: ActividadesPmService,
  ) {}

  get isView(): boolean {
    return this.data.mode === 'view';
  }

  ngOnInit(): void {
    this.setTableCols();

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
        areaImpacto: ['SELECCIONE', Validators.required],
        fechaInicio: ['', Validators.required],
        fechaTermino: ['', Validators.required],
        sede: ['', Validators.required],
        lugar: [''],
        proyectoAsociado: ['SELECCIONE'],
        resultados: ['', [Validators.maxLength(1000)]],

        tipoActividad: [null, Validators.required],

        feriaInstitucionVisitada: [''],
        feriaEstRut: [''],
        feriaEstNombre: [''],

        jornadaTemaCentral: [''],
        jornadaTalleres: [''],
        jornadaResponsableTaller: [''],
        jornadaNumAsistentes: [null],
        jornadaSatisfaccion: [null],

        tallerAsignatura: [''],
        tallerCompetencia: [''],
        tallerNombreEstudiantesBeneficiados: [null],

        congresoNombreEvento: [''],
        congresoPonenciaPresentada: [''],
        congresoRelator: [''],
        congresoNumAsistentes: [null],
        congresoSatisfaccion: [null],

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
      }),

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
          return this.api.obtenerUnidadPorCodigo(codigo).pipe(catchError(() => of(null)));
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
          return this.api.obtenerResponsablePorRut(rut).pipe(catchError(() => of(null)));
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
          return this.api.obtenerEquipoTrabajoPorRut(rut).pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((equipo) => {
        if (equipo?.nombre) {
          this.fEq('nombre').setValue(equipo.nombre, { emitEvent: false });
        }
      });

    this.cargar();
  }

  private setTableCols(): void {
    const withAction = (base: string[]) => (this.isView ? base : [...base, 'accion']);
    this.unidadCols = withAction(['n', 'cod', 'unidad']);
    this.responsableCols = withAction(['n', 'rut', 'nombre', 'tipo']);
    this.equipoCols = withAction(['n', 'rut', 'nombre', 'tipo']);
    this.finCols = withAction(['n', 'categoria', 'tipoFinanciamiento', 'monto']);
    this.ccCols = withAction(['n', 'tipo']);
    this.instCols = withAction(['n', 'tipo', 'nombre']);
    this.difusionCols = withAction(['n', 'medio', 'url']);
    this.estudianteCols = withAction(['n', 'rut', 'nombre']);
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

  getTipoActividadLabel(value?: string): string {
    if (!value) return '-';
    const hit = this.tipoActividadCatalogo.find((x) => x.value === value);
    const label = hit?.label ?? value.replaceAll('_', ' ');
    return this.fixMojibake(label);
  }

  private toDateLabel(v?: any): string {
    if (!v) return '-';
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-CL');
  }

  private toDateInput(value?: string): string {
    if (!value) return '';

    if (typeof value === 'string' && value.includes('T')) {
      return value.split('T')[0]; // ← CLAVE
    }

    if (typeof value === 'string') {
      return value;
    }

    return '';
  }

  private getArchivoEvidencia(archivos: any[], tipo: string) {
    return (archivos ?? []).find((a) => a?.tipo === tipo) ?? null;
  }

  private getArchivoNombre(archivo: any): string {
    if (!archivo) return '';
    const nombre = String(archivo?.nombre ?? '').trim();
    if (nombre) return nombre;
    const url = String(archivo?.url ?? '').trim();
    if (!url) return '';
    const parts = url.split('/');
    return parts[parts.length - 1] ?? '';
  }

  openUrl(url?: string): void {
    const u = String(url ?? '').trim();
    if (!u) return;
    window.open(u, '_blank');
  }

  private fixMojibake(value: string): string {
    if (!value) return value;
    if (!value.includes('Ã') && !value.includes('Â') && !value.includes('\uFFFD')) return value;
    try {
      return new TextDecoder('utf-8').decode(Uint8Array.from(value, (c) => c.charCodeAt(0)));
    } catch {
      return value;
    }
  }

  private normalizeToken(value: string): string {
    return this.fixMojibake(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  private normalizeSelectValue(value: any, options: string[]): string {
    const raw = this.fixMojibake(String(value ?? '')).trim();
    if (!raw) return '';
    if (options.includes(raw)) return raw;
    const rawNorm = this.normalizeToken(raw);
    const hit = options.find((o) => this.normalizeToken(o) === rawNorm);
    return hit ?? raw;
  }

  private normalizeTipoActividad(value: any): TipoActividad | null {
    const raw = this.fixMojibake(String(value ?? '')).trim();
    if (!raw) return null;
    if (this.tipoActividadCatalogo.some((x) => x.value === raw)) return raw as TipoActividad;
    const rawNorm = this.normalizeToken(raw);
    const hit = this.tipoActividadCatalogo.find((x) => this.normalizeToken(x.label) === rawNorm);
    return hit?.value ?? null;
  }

  private mapParticipanteCampo(col: string): string | null {
    const clean = col.toUpperCase();
    if (clean.includes('DIRECTIVOS') && clean.includes('UTA')) return 'directivosUta';
    if (clean.includes('DOCENTES') && clean.includes('UTA')) return 'docentesUta';
    if (clean.includes('ESTUDIANTES') && clean.includes('UTA')) return 'estudiantesUta';
    if (clean.includes('FUNCIONARIOS') && clean.includes('GESTION') && clean.includes('UTA')) return 'funcionariosGestionUta';
    if (clean.includes('EXALUMNOS')) return 'exalumnos';
    if (clean.includes('OTROS') && clean.includes('EXTERNOS')) return 'otrosExternos';
    return null;
  }

  private aplicarValidadoresTipoActividad(t?: TipoActividad | null) {
    const allSpecific = [
      'feriaInstitucionVisitada',
      'jornadaTemaCentral',
      'jornadaTalleres',
      'jornadaResponsableTaller',
      'jornadaNumAsistentes',
      'jornadaSatisfaccion',
      'tallerAsignatura',
      'tallerCompetencia',
      'tallerNombreEstudiantesBeneficiados',
      'congresoNombreEvento',
      'congresoPonenciaPresentada',
      'congresoRelator',
      'congresoNumAsistentes',
      'congresoSatisfaccion',
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

    if (t === 'FERIA_VOCACIONAL') reqText('feriaInstitucionVisitada', 200);

    if (t === 'JORNADA_PEDAGOGICA') {
      reqText('jornadaTemaCentral', 250);
      reqText('jornadaTalleres', 250);
      reqText('jornadaResponsableTaller', 200);
      reqNum('jornadaNumAsistentes');
      reqNum('jornadaSatisfaccion');
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
      reqNum('congresoNumAsistentes');
      reqNum('congresoSatisfaccion');
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

  cargar(): void {
    this.loading = true;
    this.errorMsg = '';

    this.api.obtener(this.data.id).subscribe({
      next: (a: any) => {
        const root = a?.payload ?? a ?? {};

        const proyBase =
          root?.proyecto && typeof root.proyecto === 'object' ? root.proyecto : {};

        const tipoActividad = this.normalizeTipoActividad(proyBase?.tipoActividad ?? root?.tipoActividad);
        const tipoVinculacion = this.normalizeSelectValue(
          proyBase?.tipoVinculacion ?? root?.tipoVinculacion,
          this.tiposVinculacion,
        );
        const areaVinculacion = this.normalizeSelectValue(
          proyBase?.areaVinculacion ?? root?.areaVinculacion,
          this.areasVinculacion,
        );
        const areaImpacto = this.normalizeSelectValue(
          proyBase?.areaImpacto ?? root?.areaImpacto,
          this.areasImpacto,
        );
        const sede = this.normalizeSelectValue(proyBase?.sede ?? root?.sede, this.sedes);

        const proyectoAsociado = this.normalizeSelectValue(
          proyBase?.proyectoAsociado ??
            proyBase?.proyecto ??
            (typeof root?.proyecto === 'string' ? root.proyecto : root?.proyectoAsociado),
          this.proyectos,
        );

        const proy = {
          ...proyBase,
          tipoActividad: tipoActividad ?? proyBase?.tipoActividad,
          tipoVinculacion,
          areaVinculacion,
          areaImpacto,
          sede,
          proyectoAsociado,

          feriaInstitucionVisitada: proyBase?.feriaInstitucionVisitada ?? root?.institucionVisitada,
          jornadaTemaCentral: proyBase?.jornadaTemaCentral ?? root?.temaCentral,
          jornadaTalleres: proyBase?.jornadaTalleres ?? root?.talleres,
          jornadaResponsableTaller: proyBase?.jornadaResponsableTaller ?? root?.responsableTaller,

          tallerAsignatura: proyBase?.tallerAsignatura ?? root?.asignaturaRemedial,
          tallerCompetencia: proyBase?.tallerCompetencia ?? root?.competenciaAReforzar,
          tallerNombreEstudiantesBeneficiados:
            proyBase?.tallerNombreEstudiantesBeneficiados ?? root?.numeroEstudiantesBeneficiados,

          congresoNombreEvento: proyBase?.congresoNombreEvento ?? root?.nombreEvento,
          congresoPonenciaPresentada: proyBase?.congresoPonenciaPresentada ?? root?.ponenciaPresentada,
          congresoRelator: proyBase?.congresoRelator ?? root?.relator,

          alternanciaColegioAsociado: proyBase?.alternanciaColegioAsociado ?? root?.colegioAsociado,
          alternanciaDocenteColaborador: proyBase?.alternanciaDocenteColaborador ?? root?.docenteColaborador,
          alternanciaAsignatura: proyBase?.alternanciaAsignatura ?? root?.asignaturaAlternancia,
          alternanciaCurso: proyBase?.alternanciaCurso ?? root?.curso,
          alternanciaDocenteAsignatura: proyBase?.alternanciaDocenteAsignatura ?? root?.docenteAsignatura,
          alternanciaNombreActividad: proyBase?.alternanciaNombreActividad ?? root?.nombreActividadAlternancia,

          salidaObjetivoPedagogico: proyBase?.salidaObjetivoPedagogico ?? root?.objetivoPedagogico,
          salidaAsignaturaVinculada: proyBase?.salidaAsignaturaVinculada ?? root?.asignaturaVinculada,
          salidaProfesorResponsable: proyBase?.salidaProfesorResponsable ?? root?.profesorResponsable,
        };

        const archivos = root?.archivosEvidencia ?? a?.archivosEvidencia ?? [];
        const archivoAsistencia = this.getArchivoEvidencia(archivos, 'LISTA_ASISTENCIA');
        const archivoDocumentos = this.getArchivoEvidencia(archivos, 'DOCUMENTO');
        const archivoFotos = this.getArchivoEvidencia(archivos, 'FOTOGRAFIA');

        this.actividad = { ...root, ...proy };

        const asistentesGeneric =
          proyBase?.numeroAsistentes ?? root?.numeroAsistentes ?? null;
        const satisfGeneric =
          proyBase?.nivelSatisfaccion ?? root?.nivelSatisfaccion ?? null;

        const proyectoForm: any = {
          ...proy,
          nombre: proy?.nombre ?? proyBase?.nombre ?? root?.nombre ?? '',
          objetivo: proy?.objetivo ?? proyBase?.objetivo ?? root?.objetivo ?? '',
          descripcion: proy?.descripcion ?? proyBase?.descripcion ?? root?.descripcion ?? '',
          lugar: proy?.lugar ?? proyBase?.lugar ?? root?.lugar ?? '',
          resultados: proy?.resultados ?? proyBase?.resultados ?? root?.resultados ?? '',
          fechaInicio: this.toDateInput(proy?.fechaInicio ?? proyBase?.fechaInicio ?? root?.fechaInicio),
          fechaTermino: this.toDateInput(proy?.fechaTermino ?? proyBase?.fechaTermino ?? root?.fechaTermino),
        };

        if (tipoActividad === 'JORNADA_PEDAGOGICA') {
          if (proyectoForm.jornadaNumAsistentes == null && asistentesGeneric != null) {
            proyectoForm.jornadaNumAsistentes = asistentesGeneric;
          }
          if (proyectoForm.jornadaSatisfaccion == null && satisfGeneric != null) {
            proyectoForm.jornadaSatisfaccion = satisfGeneric;
          }
        }
        if (tipoActividad === 'CONGRESO_ACADEMICO') {
          if (proyectoForm.congresoNumAsistentes == null && asistentesGeneric != null) {
            proyectoForm.congresoNumAsistentes = asistentesGeneric;
          }
          if (proyectoForm.congresoSatisfaccion == null && satisfGeneric != null) {
            proyectoForm.congresoSatisfaccion = satisfGeneric;
          }
        }

        this.form.patchValue({
          proyecto: proyectoForm,
          evidencias: {
            ...(root?.evidencias ?? {}),
            listaAsistenciaRef: root?.evidencias?.listaAsistenciaRef ?? archivoAsistencia?.url ?? '',
            documentosRef: root?.evidencias?.documentosRef ?? archivoDocumentos?.url ?? '',
            fotosRef: root?.evidencias?.fotosRef ?? archivoFotos?.url ?? '',
            enlaceNoticia: root?.evidencias?.enlaceNoticia ?? root?.enlaceNoticia ?? '',
            observaciones: root?.evidencias?.observaciones ?? root?.observaciones ?? '',
          },
          participantes: {
            ...(root?.participantes ?? {}),
          },
          impacto: {
            medidaImpacto: root?.impacto?.medidaImpacto ?? root?.medidaImpacto ?? 'ENCUESTA',
            indicadorImpacto: root?.impacto?.indicadorImpacto ?? root?.indicadorImpacto ?? '',
          },
          difusion: {
            difusionEquipo:
              root?.difusion?.difusionEquipo ??
              root?.difusion?.medio ??
              root?.medioDifusion ??
              'SELECCIONE',
            difusionUrl: root?.difusion?.difusionUrl ?? root?.difusion?.url ?? root?.urlDifusion ?? '',
          },
        });

        this.asistenciaFileName = this.getArchivoNombre(archivoAsistencia);
        this.documentosFileName = this.getArchivoNombre(archivoDocumentos);
        this.fotosFileName = this.getArchivoNombre(archivoFotos);

        const matrices = root?.matricesParticipantes ?? a?.matricesParticipantes ?? [];
        if (Array.isArray(matrices) && matrices.length > 0) {
          const g = this.form.get('participantes') as FormGroup;
          for (const tipo of ['ASISTENTE', 'EXPOSITOR'] as const) {
            const row = matrices.find((m: any) => m?.tipoParticipante === tipo);
            if (!row) continue;
            for (const col of this.participantesColumnas) {
              const field = this.mapParticipanteCampo(col);
              const key = this.key(tipo, col);
              if (!field || !g.get(key)) continue;
              g.get(key)?.setValue(row[field] ?? 0, { emitEvent: false });
            }
          }
        }

        const unidadesRaw = a?.unidades ?? root?.unidades ?? [];
        this.unidades = (unidadesRaw ?? []).map((u: any) => ({
          cod: u?.cod ?? u?.codigo ?? u?.unidad?.codigo ?? '',
          unidad: u?.unidad?.nombre ?? u?.nombre ?? u?.unidad ?? '',
        }));

        const responsablesRaw = a?.responsables ?? root?.responsables ?? [];
        this.responsables = (responsablesRaw ?? []).map((r: any) => ({
          rut: r?.rut ?? r?.responsable?.rut ?? '',
          nombre: r?.nombre ?? r?.responsable?.nombre ?? '',
          tipo: r?.tipo ?? r?.responsable?.tipo ?? '',
        }));

        const equipoRaw =
          a?.equiposTrabajo ?? root?.equiposTrabajo ?? a?.equipoTrabajo ?? root?.equipoTrabajo ?? [];
        this.equipoTrabajo = (equipoRaw ?? []).map((e: any) => ({
          rut: e?.rut ?? e?.equipoTrabajo?.rut ?? '',
          nombre: e?.nombre ?? e?.equipoTrabajo?.nombre ?? '',
          tipo: e?.equipo ?? e?.tipo ?? '',
        }));

        const finRaw = a?.financiamientos ?? root?.financiamientos ?? [];
        this.financiamientos = (finRaw ?? []).map((f: any) => ({
          categoria: f?.categoria ?? f?.finCategoria ?? '',
          tipoFinanciamiento: f?.tipoFinanciamiento ?? f?.tipo ?? '',
          monto: f?.monto ?? f?.finMonto ?? 0,
        }));

        const ccRaw = a?.centrosCosto ?? root?.centrosCosto ?? [];
        this.centrosCosto = (ccRaw ?? []).map((c: any) => ({
          tipo: c?.tipo ?? c?.nombre ?? '',
        }));

        const difusionesRaw = a?.difusiones ?? root?.difusiones ?? [];
        if (Array.isArray(difusionesRaw) && difusionesRaw.length > 0) {
          this.difusiones = difusionesRaw.map((d: any) => ({
            medio: d?.medio ?? d?.difusionEquipo ?? '',
            url: d?.url ?? d?.difusionUrl ?? '',
          }));
        } else if (root?.medioDifusion || root?.urlDifusion) {
          this.difusiones = [{ medio: root?.medioDifusion ?? '', url: root?.urlDifusion ?? '' }];
        } else {
          this.difusiones = [];
        }

        const instRaw = a?.instituciones ?? root?.instituciones ?? [];
        this.instituciones = (instRaw ?? []).map((i: any) => ({
          tipo: i?.tipo ?? '',
          nombre: i?.nombre ?? '',
        }));

        const est = a?.estudiantes ?? root?.estudiantes ?? [];
        this.estudiantesFeria = est ?? [];
        this.estudiantesSalida = [];

        if (this.isView) {
          this.form.disable({ emitEvent: false });
        }

        this.updateEquipoValidators();
        this.updateInstitucionValidators();

        this.loading = false;
      },
      error: () => {
        this.errorMsg = 'No se pudo cargar la actividad.';
        this.loading = false;
      },
    });
  }

  cerrar(): void {
    this.dialogRef.close({ refresh: false });
  }

  guardar(): void {
    if (this.isView) return;

    if (this.unidades.length === 0) {
      this.form.markAllAsTouched();
      this.showUnidadError = true;
      this.goToSection('sec-unidades', 1);
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

    this.saving = true;

    this.api.actualizar(this.data.id, request as any).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close({ refresh: true });
      },
      error: (err) => {
        console.error(err);
        this.errorMsg = 'No se pudo guardar los cambios.';
        this.saving = false;
      },
    });
  }

  key(tipo: string, col: string): string {
    return `${tipo}__${col}`.replace(/\s+/g, '_').replace(/[()]/g, '');
  }

  grabarParticipantes(): void {
    const g = this.form.get('participantes') as FormGroup;
    console.log('Participantes (matriz):', g.value);
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
  }

  removeUnidad(row: UnidadRow): void {
    this.unidades = this.unidades.filter((x) => x !== row);
  }

  editUnidad(row: UnidadRow): void {
    this.fProy('unidadCod').setValue(row.cod);
    this.fProy('unidadNombre').setValue(row.unidad);
    this.removeUnidad(row);
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
  }

  removeResponsable(row: ResponsableRow): void {
    this.responsables = this.responsables.filter((x) => x !== row);
  }

  editResponsable(row: ResponsableRow): void {
    this.fProy('responsableRut').setValue(row.rut);
    this.fProy('responsableNombre').setValue(row.nombre);
    this.fProy('responsableTipo').setValue(row.tipo);
    this.removeResponsable(row);
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
  }

  removeEquipo(row: EquipoRow): void {
    this.equipoTrabajo = this.equipoTrabajo.filter((x) => x !== row);
    this.updateEquipoValidators();
  }

  editEquipo(row: EquipoRow): void {
    const g = this.form.get('equipoTrabajo') as FormGroup;
    g.get('rut')?.setValue(row.rut);
    g.get('nombre')?.setValue(row.nombre);
    g.get('tipo')?.setValue(row.tipo);
    this.removeEquipo(row);
  }

  addFinanciamiento(): void {
    const g = this.form.get('financiamiento') as FormGroup;
    const categoria = g.get('finCategoria')?.value;
    const tipoFinanciamiento = g.get('finTipoFinanciamiento')?.value;
    const monto = Number(g.get('finMonto')?.value ?? 0);

    if (!categoria || !tipoFinanciamiento) return;

    this.financiamientos = [
      ...this.financiamientos,
      { categoria, tipoFinanciamiento, monto: isNaN(monto) ? 0 : monto },
    ];
    g.get('finCategoria')?.setValue('');
    g.get('finTipoFinanciamiento')?.setValue('');
    g.get('finMonto')?.setValue(0);
    g.markAsPristine();
    g.markAsUntouched();
  }

  removeFin(row: FinRow): void {
    this.financiamientos = this.financiamientos.filter((x) => x !== row);
  }

  editFinanciamiento(row: FinRow): void {
    const g = this.form.get('financiamiento') as FormGroup;
    g.get('finCategoria')?.setValue(row.categoria);
    g.get('finTipoFinanciamiento')?.setValue(row.tipoFinanciamiento);
    g.get('finMonto')?.setValue(row.monto);
    this.removeFin(row);
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
  }

  removeInstitucion(row: InstRow): void {
    this.instituciones = this.instituciones.filter((x) => x !== row);
    this.updateInstitucionValidators();
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

    if (!medio || medio === 'SELECCIONE') return;

    this.difusiones = [...this.difusiones, { medio, url }];
    g.get('difusionEquipo')?.setValue('SELECCIONE');
    g.get('difusionUrl')?.setValue('');
    g.markAsPristine();
    g.markAsUntouched();
  }

  removeDifusion(row: DifusionRow): void {
    this.difusiones = this.difusiones.filter((x) => x !== row);
  }

  editDifusion(row: DifusionRow): void {
    const g = this.form.get('difusion') as FormGroup;
    g.get('difusionEquipo')?.setValue(row.medio);
    g.get('difusionUrl')?.setValue(row.url);
    this.removeDifusion(row);
  }

  onFileSelected(event: Event, tipo: 'asistencia' | 'documentos' | 'fotos'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const maxMb = 10;
    const sizeOk = file.size <= maxMb * 1024 * 1024;

    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const allow = {
      asistencia: ['pdf', 'xls', 'xlsx'],
      documentos: ['pdf', 'xls', 'xlsx'],
      fotos: ['jpg', 'jpeg', 'png'],
    }[tipo];

    if (!allow.includes(ext) || !sizeOk) {
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

  private rutValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const v = String(control.value ?? '').trim();
      if (!v) return null;
      const okFormat = /^\d{1,2}(\.\d{3}){2}-[0-9K]$/i.test(v);
      if (!okFormat) return { rut: true };
      return null;
    };
  }

  private goToSection(id: string, tabIndex: number) {
    this.selectedTabIndex = tabIndex;
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
      if (typeof (invalid as any).focus === 'function') (invalid as any).focus();
    }, 0);
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