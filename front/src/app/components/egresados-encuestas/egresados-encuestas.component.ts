import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  EncuestaEgresadosPayload,
  EncuestasEgresadosService,
} from '../../services/encuestas-egresados.service';
import { formatDateEs, parseDateFlexible } from '../../utils/date-utils';

type SurveyId = 'EMPLEABILIDAD' | 'ACREDITACION';

interface SurveyCard {
  id: SurveyId;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  cardClass?: string;
}

interface AcreditacionSection {
  id: string;
  title: string;
  questions: Array<{ key: string; text: string }>;
}

@Component({
  standalone: true,
  selector: 'app-egresados-encuestas',
  imports: [
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  templateUrl: './egresados-encuestas.component.html',
  styleUrls: ['./egresados-encuestas.component.scss'],
})
export class EgresadosEncuestasComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(EncuestasEgresadosService);
  private snack = inject(MatSnackBar);

  registroVisible = false;
  selectedSurvey: SurveyCard | null = null;
  selectedEncuesta: any | null = null;
  isSaving = false;
  isLoadingEncuestas = false;
  encuestas: any[] = [];

  readonly encuestasDisponibles: SurveyCard[] = [
    {
      id: 'EMPLEABILIDAD',
      title: 'Encuesta de empleabilidad',
      subtitle: 'Indicadores laborales y percepcion de la formacion.',
      description:
        'Explora la insercion laboral y la pertinencia de la formacion profesional.',
      icon: 'work_outline',
      cardClass: 'green-card',
    },
    {
      id: 'ACREDITACION',
      title: 'Encuesta de egresados',
      subtitle: 'Evidencia para procesos de autoevaluacion.',
      description:
        'Recoge la opinion de egresados para fortalecer la acreditacion.',
      icon: 'verified',
    },
  ];

  readonly opcionesSiNo = ['Si', 'No'];
  readonly opcionesSexo = ['Mujer', 'Hombre', 'Prefiere no responder'];
  readonly tiemposPrimerTrabajo = [
    'Menos de 2 meses',
    'Entre 2 y 6 meses',
    'Entre 6 meses y 1 ano',
    'Mas de 1 ano',
    'No he encontrado trabajo',
  ];
  readonly situacionesLaborales = [
    'Jefatura',
    'Empleado(a)',
    'Independiente',
    'Otro',
  ];
  readonly sectoresTrabajo = ['Publico', 'Privado', 'Otro'];
  readonly rentas = [
    'Sueldo minimo',
    'Entre $500.001 y $1.000.000',
    'Entre $1.000.001 y $1.500.000',
    'Mas de $1.500.001',
  ];
  readonly tiposInstitucion = [
    'Establecimiento del Estado',
    'Particular subvencionado',
    'Particular',
    'Otro',
    'No corresponde (no trabaja en educacion)',
  ];
  readonly escalaPertinencia = [
    'Muy en desacuerdo',
    'En desacuerdo',
    'Ni de acuerdo ni en desacuerdo',
    'De acuerdo',
    'Muy de acuerdo',
  ];
  readonly escalaLikert = [
    'Muy en desacuerdo',
    'En desacuerdo',
    'Ni de acuerdo ni en desacuerdo',
    'De acuerdo',
    'Muy de acuerdo',
  ];
  readonly opcionesPregunta9 = [
    'Practicas profesionales / practicas pedagogicas',
    'Formacion disciplinar en historia y geografia',
    'Didactica y metodologia de ensenanza',
    'Competencias blandas (comunicacion, liderazgo, gestion de aula)',
    'Vinculacion con escuelas / redes educativas',
    'Flexibilidad curricular / electivos',
    'Otros',
  ];
  readonly opcionesPregunta10 = [
    'Mayor vinculacion con establecimientos educacionales',
    'Mas formacion en habilidades blandas y gestion de aula',
    'Actualizacion tecnologica / TIC',
    'Fortalecer ingles u otros idiomas',
    'Mejor orientacion laboral / talleres de empleabilidad',
    'Otros (respuestas no clasificables)',
  ];

  readonly acreditacionSections: AcreditacionSection[] = [
    {
      id: 'perfilEgreso',
      title: 'Seccion II: Perfil de egreso',
      questions: [
        { key: 'p1', text: 'Conoci el perfil de egreso de la carrera.' },
        { key: 'p2', text: 'La formacion recibida corresponde al perfil de egreso declarado.' },
      ],
    },
    {
      id: 'planEstudios',
      title: 'Seccion III: Plan de estudios y formacion',
      questions: [
        { key: 'p3', text: 'El plan de estudios fue consistente con el perfil de egreso.' },
        { key: 'p4', text: 'Las asignaturas ofrecidas ayudaron al logro del perfil de egreso.' },
        { key: 'p5', text: 'Las evaluaciones eran pertinentes y coherentes con los objetivos de aprendizaje.' },
        { key: 'p6', text: 'Participe en actividades sobre etica, inclusion, diversidad y responsabilidad social.' },
      ],
    },
    {
      id: 'formacionPractica',
      title: 'Seccion IV: Formacion practica',
      questions: [
        { key: 'p7', text: 'Las practicas profesionales se realizaron con instituciones pertinentes.' },
        { key: 'p8', text: 'Existio acompanamiento y supervision formal en la formacion practica.' },
        { key: 'p9', text: 'Las actividades de practica fueron evaluadas con pautas claras.' },
      ],
    },
    {
      id: 'cuerpoAcademico',
      title: 'Seccion V: Cuerpo academico',
      questions: [
        { key: 'p10', text: 'Los profesores tenian conocimientos actualizados y metodologias adecuadas.' },
        { key: 'p11', text: 'Existia un equipo docente que lideraba el proyecto formativo.' },
        { key: 'p12', text: 'Recibi material y herramientas elaboradas por mis docentes.' },
      ],
    },
    {
      id: 'gestionRecursos',
      title: 'Seccion VI: Gestion institucional y recursos',
      questions: [
        { key: 'p13', text: 'La infraestructura y equipamiento eran adecuados para el aprendizaje.' },
        { key: 'p14', text: 'La biblioteca y recursos digitales eran suficientes.' },
        { key: 'p15', text: 'Existian mecanismos formalizados para atender solicitudes de estudiantes.' },
        { key: 'p16', text: 'La gestion del cuerpo directivo permitia una conduccion eficaz.' },
      ],
    },
    {
      id: 'autorregulacion',
      title: 'Seccion VII: Autorregulacion y mejora continua',
      questions: [
        { key: 'p17', text: 'Participe en procesos de autoevaluacion de la carrera.' },
        { key: 'p18', text: 'Observe mejoras durante mi formacion por aseguramiento de calidad.' },
        { key: 'p19', text: 'La carrera apoya insercion profesional y seguimiento de titulados.' },
      ],
    },
  ];

  readonly form = this.fb.group({
    generales: this.fb.group({
      anioEgreso: ['', Validators.required],
      edad: ['', Validators.required],
      sexo: ['', Validators.required],
    }),
    insercion: this.fb.group({
      trabajaActualmente: ['', Validators.required],
      tiempoPrimerTrabajo: ['', Validators.required],
      situacionLaboral: ['', Validators.required],
      sectorTrabajo: ['', Validators.required],
    }),
    condiciones: this.fb.group({
      renta: ['', Validators.required],
      tipoInstitucion: ['', Validators.required],
    }),
    percepcion: this.fb.group({
      pertinencia: ['', Validators.required],
      postgrado: ['', Validators.required],
      postgradoDetalle: [''],
      capacitacion: ['', Validators.required],
      capacitacionDetalle: [''],
    }),
    abiertas: this.fb.group({
      aspectosAyuda: ['', Validators.required],
      mejoras: ['', Validators.required],
    }),
  });

  readonly acreditacionForm = this.buildAcreditacionForm();

  ngOnInit(): void {
    this.initDynamicRules();
    this.applyInitialControlState();
    this.loadEncuestas();
  }

  openRegistro(survey: SurveyCard): void {
    this.selectedEncuesta = null;
    this.selectedSurvey = survey;
    this.registroVisible = true;
    if (survey.id === 'EMPLEABILIDAD') {
      this.form.reset({}, { emitEvent: false });
      this.applyInitialControlState();
    }
    if (survey.id === 'ACREDITACION') {
      this.acreditacionForm.reset({}, { emitEvent: false });
    }
  }

  cerrarRegistro(): void {
    this.registroVisible = false;
    this.selectedSurvey = null;
  }

  verDetalles(encuesta: any): void {
    this.selectedEncuesta = encuesta;
  }

  cerrarDetalles(): void {
    this.selectedEncuesta = null;
  }

  submit(): void {
    const isAcreditacion = this.selectedSurvey?.id === 'ACREDITACION';
    const currentForm = (isAcreditacion
      ? this.acreditacionForm
      : this.form) as FormGroup;

    if (currentForm.invalid) {
      currentForm.markAllAsTouched();
      this.snack.open('Completa los campos obligatorios.', 'Cerrar', { duration: 3000 });
      return;
    }

    const now = new Date();
    const payload: EncuestaEgresadosPayload = {
      tipo: 'EGRESADOS',
      anioEncuesta: now.getFullYear(),
      semestreEncuesta: this.computeSemestre(now),
      data: {
        encuestaTipo: this.selectedSurvey?.id ?? 'EMPLEABILIDAD',
        generales: currentForm.get('generales')?.value ?? {},
        insercion: isAcreditacion ? undefined : this.form.get('insercion')?.value ?? {},
        condiciones: isAcreditacion ? undefined : this.form.get('condiciones')?.value ?? {},
        percepcion: isAcreditacion ? undefined : this.form.get('percepcion')?.value ?? {},
        secciones: isAcreditacion ? this.acreditacionForm.get('secciones')?.value ?? {} : undefined,
        abiertas: isAcreditacion ? this.acreditacionForm.get('abiertas')?.value ?? {} : this.form.get('abiertas')?.value ?? {},
      },
    };

    this.isSaving = true;
    this.api.crear(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.snack.open('Encuesta enviada correctamente.', 'OK', { duration: 3000 });
        currentForm.reset({}, { emitEvent: false });
        if (!isAcreditacion) {
          this.applyInitialControlState();
        }
        this.cerrarRegistro();
        this.loadEncuestas();
      },
      error: (err) => {
        console.error(err);
        this.isSaving = false;
        this.snack.open('Error al enviar la encuesta.', 'Cerrar', { duration: 4000 });
      },
    });
  }

  private computeSemestre(d = new Date()): 1 | 2 {
    const month = d.getMonth();
    return month <= 5 ? 1 : 2;
  }

  private loadEncuestas(): void {
    this.isLoadingEncuestas = true;
    this.api.getAll().subscribe({
      next: (data) => {
        this.encuestas = (data || []).map((e) => ({
          ...e,
          fecha: parseDateFlexible(e.fecha),
        }));
        this.isLoadingEncuestas = false;
      },
      error: (err) => {
        console.error(err);
        this.encuestas = [];
        this.isLoadingEncuestas = false;
      },
    });
  }

  mapTipoLabel(tipo: SurveyId | string | null | undefined): string {
    if (tipo === 'EMPLEABILIDAD') return 'Encuesta de empleabilidad';
    if (tipo === 'ACREDITACION') return 'Encuesta de egresados';
    return 'Encuesta de egresados';
  }

  formatFecha(value?: string | Date | null): string {
    return formatDateEs(value);
  }

  getGeneralesLinea1(encuesta: any): string {
    const generales = encuesta?.generales || {};
    const anio = generales?.anioEgreso ?? 'Sin dato';
    const edad = generales?.edad ?? 'Sin dato';
    return `Ano egreso: ${anio} - Edad: ${edad}`;
  }

  getGeneralesLinea2(encuesta: any): string {
    const generales = encuesta?.generales || {};
    const sexo = generales?.sexo ?? 'Sin dato';
    return `Sexo: ${sexo}`;
  }

  getGeneralesRows(encuesta: any): Array<{ key: string; value: string }> {
    const generales = encuesta?.generales || {};
    const rows: Array<{ key: string; value: string }> = [];
    const push = (key: string, value: any) => {
      if (value !== undefined && value !== null && value !== '') {
        rows.push({ key, value: String(value) });
      }
    };

    push('Ano de egreso', generales.anioEgreso);
    push('Edad', generales.edad);
    push('Sexo', generales.sexo);
    return rows;
  }

  mapRespuestaValor(respuesta: any): string {
    return respuesta?.alternativa?.descripcion ?? respuesta?.respuestaAbierta ?? '';
  }

  mapPreguntaDescripcion(clave: string | null | undefined): string {
    if (!clave) return '';

    const labels: Record<string, string> = {
      'insercion.trabajaActualmente': 'Actualmente se encuentra trabajando?',
      'insercion.tiempoPrimerTrabajo':
        'Cuanto tiempo demoro en encontrar su primer trabajo?',
      'insercion.situacionLaboral': 'Cual es su situacion laboral actual?',
      'insercion.sectorTrabajo': 'Sector en el que trabaja',
      'condiciones.renta': 'Nivel de renta liquida mensual',
      'condiciones.tipoInstitucion':
        'Tipo de institucion educativa (si trabaja en educacion)',
      'percepcion.pertinencia':
        'La formacion recibida fue pertinente para su desempeno laboral?',
      'percepcion.postgrado':
        'Ha realizado estudios de postgrado desde que egreso?',
      'percepcion.postgradoDetalle': 'Tipo e institucion (postgrado)',
      'percepcion.capacitacion':
        'Ha realizado cursos de capacitacion adicional?',
      'percepcion.capacitacionDetalle': 'Tipo e institucion (capacitacion)',
      'abiertas.aspectosAyuda':
        'Aspectos que ayudaron mas en la insercion laboral',
      'abiertas.mejoras':
        'Mejoras sugeridas para fortalecer la empleabilidad',
      'secciones.perfilEgreso.p1': 'Conoci el perfil de egreso de la carrera.',
      'secciones.perfilEgreso.p2':
        'La formacion recibida corresponde al perfil de egreso declarado.',
      'secciones.planEstudios.p3': 'El plan de estudios fue consistente con el perfil de egreso.',
      'secciones.planEstudios.p4': 'Las asignaturas ofrecidas ayudaron al logro del perfil de egreso.',
      'secciones.planEstudios.p5':
        'Las evaluaciones eran pertinentes y coherentes con los objetivos de aprendizaje.',
      'secciones.planEstudios.p6':
        'Participe en actividades sobre etica, inclusion, diversidad y responsabilidad social.',
      'secciones.formacionPractica.p7':
        'Las practicas profesionales se realizaron con instituciones pertinentes.',
      'secciones.formacionPractica.p8':
        'Existio acompanamiento y supervision formal en la formacion practica.',
      'secciones.formacionPractica.p9':
        'Las actividades de practica fueron evaluadas con pautas claras.',
      'secciones.cuerpoAcademico.p10':
        'Los profesores tenian conocimientos actualizados y metodologias adecuadas.',
      'secciones.cuerpoAcademico.p11':
        'Existia un equipo docente que lideraba el proyecto formativo.',
      'secciones.cuerpoAcademico.p12':
        'Recibi material y herramientas elaboradas por mis docentes.',
      'secciones.gestionRecursos.p13':
        'La infraestructura y equipamiento eran adecuados para el aprendizaje.',
      'secciones.gestionRecursos.p14': 'La biblioteca y recursos digitales eran suficientes.',
      'secciones.gestionRecursos.p15':
        'Existian mecanismos formalizados para atender solicitudes de estudiantes.',
      'secciones.gestionRecursos.p16':
        'La gestion del cuerpo directivo permitia una conduccion eficaz.',
      'secciones.autorregulacion.p17':
        'Participe en procesos de autoevaluacion de la carrera.',
      'secciones.autorregulacion.p18':
        'Observe mejoras durante mi formacion por aseguramiento de calidad.',
      'secciones.autorregulacion.p19':
        'La carrera apoya insercion profesional y seguimiento de titulados.',
      'abiertas.fortalezas': 'Fortalezas de la carrera',
      'abiertas.debilidades': 'Debilidades o aspectos a mejorar',
      'abiertas.sugerencias': 'Sugerencias adicionales',
    };

    return labels[clave] || clave;
  }

  private buildAcreditacionForm() {
    const seccionesGroup: Record<string, any> = {};
    for (const sec of this.acreditacionSections) {
      const qCtrls: Record<string, any> = {};
      for (const q of sec.questions) {
        qCtrls[q.key] = ['', Validators.required];
      }
      seccionesGroup[sec.id] = this.fb.group(qCtrls);
    }

    return this.fb.group({
      generales: this.fb.group({
        anioEgreso: ['', Validators.required],
        edad: ['', Validators.required],
        sexo: ['', Validators.required],
      }),
      secciones: this.fb.group(seccionesGroup),
      abiertas: this.fb.group({
        fortalezas: [''],
        debilidades: [''],
        sugerencias: [''],
      }),
    });
  }

  get showPostgradoDetalle(): boolean {
    return this.form.get('percepcion.postgrado')?.value === 'Si';
  }

  get showCapacitacionDetalle(): boolean {
    return this.form.get('percepcion.capacitacion')?.value === 'Si';
  }

  private initDynamicRules(): void {
    this.form.get('insercion.trabajaActualmente')?.valueChanges.subscribe((value) => {
      const requiresWorkInfo = value === 'Si';
      const tiempoCtrl = this.form.get('insercion.tiempoPrimerTrabajo');
      const situacionCtrl = this.form.get('insercion.situacionLaboral');
      const sectorCtrl = this.form.get('insercion.sectorTrabajo');
      const rentaCtrl = this.form.get('condiciones.renta');
      const institucionCtrl = this.form.get('condiciones.tipoInstitucion');

      if (requiresWorkInfo) {
        tiempoCtrl?.enable({ emitEvent: false });
        situacionCtrl?.enable({ emitEvent: false });
        sectorCtrl?.enable({ emitEvent: false });
        rentaCtrl?.enable({ emitEvent: false });
        institucionCtrl?.enable({ emitEvent: false });
        tiempoCtrl?.setValidators([Validators.required]);
        situacionCtrl?.setValidators([Validators.required]);
        sectorCtrl?.setValidators([Validators.required]);
        rentaCtrl?.setValidators([Validators.required]);
        institucionCtrl?.setValidators([Validators.required]);
      } else {
        tiempoCtrl?.reset('', { emitEvent: false });
        situacionCtrl?.reset('', { emitEvent: false });
        sectorCtrl?.reset('', { emitEvent: false });
        tiempoCtrl?.disable({ emitEvent: false });
        situacionCtrl?.disable({ emitEvent: false });
        sectorCtrl?.disable({ emitEvent: false });
        rentaCtrl?.reset('', { emitEvent: false });
        institucionCtrl?.reset('', { emitEvent: false });
        rentaCtrl?.disable({ emitEvent: false });
        institucionCtrl?.disable({ emitEvent: false });
        tiempoCtrl?.clearValidators();
        situacionCtrl?.clearValidators();
        sectorCtrl?.clearValidators();
        rentaCtrl?.clearValidators();
        institucionCtrl?.clearValidators();
      }

      tiempoCtrl?.updateValueAndValidity({ emitEvent: false });
      situacionCtrl?.updateValueAndValidity({ emitEvent: false });
      sectorCtrl?.updateValueAndValidity({ emitEvent: false });
      rentaCtrl?.updateValueAndValidity({ emitEvent: false });
      institucionCtrl?.updateValueAndValidity({ emitEvent: false });
    });

    this.form.get('percepcion.postgrado')?.valueChanges.subscribe((value) => {
      const detalleCtrl = this.form.get('percepcion.postgradoDetalle');
      if (value === 'Si') {
        detalleCtrl?.enable({ emitEvent: false });
      } else {
        detalleCtrl?.reset('', { emitEvent: false });
        detalleCtrl?.disable({ emitEvent: false });
      }
      detalleCtrl?.updateValueAndValidity({ emitEvent: false });
    });

    this.form.get('percepcion.capacitacion')?.valueChanges.subscribe((value) => {
      const detalleCtrl = this.form.get('percepcion.capacitacionDetalle');
      if (value === 'Si') {
        detalleCtrl?.enable({ emitEvent: false });
      } else {
        detalleCtrl?.reset('', { emitEvent: false });
        detalleCtrl?.disable({ emitEvent: false });
      }
      detalleCtrl?.updateValueAndValidity({ emitEvent: false });
    });
  }

  private applyInitialControlState(): void {
    this.form.get('insercion.tiempoPrimerTrabajo')?.disable({ emitEvent: false });
    this.form.get('insercion.situacionLaboral')?.disable({ emitEvent: false });
    this.form.get('insercion.sectorTrabajo')?.disable({ emitEvent: false });
    this.form.get('condiciones.renta')?.disable({ emitEvent: false });
    this.form.get('condiciones.tipoInstitucion')?.disable({ emitEvent: false });
    this.form.get('percepcion.postgradoDetalle')?.disable({ emitEvent: false });
    this.form.get('percepcion.capacitacionDetalle')?.disable({ emitEvent: false });

    this.form.get('insercion.tiempoPrimerTrabajo')?.clearValidators();
    this.form.get('insercion.situacionLaboral')?.clearValidators();
    this.form.get('insercion.sectorTrabajo')?.clearValidators();
    this.form.get('condiciones.renta')?.clearValidators();
    this.form.get('condiciones.tipoInstitucion')?.clearValidators();
  }
}




