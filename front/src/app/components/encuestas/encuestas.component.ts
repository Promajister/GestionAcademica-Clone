// Componente principal de gestión de encuestas (estudiantiles y colaboradores)
import { Component, OnInit, inject, Injectable } from '@angular/core';
import { ColaboradoresService } from '../../services/colaboradores.service';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClientModule, HttpErrorResponse } from '@angular/common/http';
import { EncuestasApiService, ApiEncuesta } from '../../services/encuestas-api.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, NativeDateAdapter, MAT_DATE_FORMATS, DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { RouterModule } from '@angular/router';
import { MatExpansionModule } from '@angular/material/expansion';
import { forkJoin } from 'rxjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Tipos de encuesta manejados por el módulo
export type TipoEncuesta = 'ESTUDIANTIL' | 'COLABORADORES_JEFES';

// Estructura interna para mostrar encuestas en la UI
export interface EncuestaRegistro {
  id: string;
  tipo: TipoEncuesta;
  fecha: Date;
  origenArchivo?: string;
  metadata: { [key: string]: any };
  respuestas: {
    preguntaId: number;
    pregunta?: { descripcion: string };
    alternativa?: { descripcion: string };
    respuestaAbierta?: string;
  }[];
}

// Estadísticas por pregunta (para tablas tipo Excel)
type TipoEscala = 'ESCALA5' | 'SI_NO' | 'PARTICIPACION' | 'NORMATIVAS';

interface EstadisticaPregunta {
  key: string;
  label: string;
  escala: TipoEscala;
  conteos: { [valor: string]: number };
  totalEncuestas: number;
}

const anioActual = new Date().getFullYear();

@Injectable()
export class CustomDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: Object): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  override parse(value: string): Date | null {
    if (!value) return null;
    const parts = value.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const date = new Date(year, month, day);
        if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
          return date;
        }
      }
    }
    return super.parse(value);
  }
}

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
  selector: 'app-encuestas',
  standalone: true,
  templateUrl: './encuestas.component.html',
  styleUrls: ['./encuestas.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,
    MatRadioModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatExpansionModule,
  ],
  providers: [
    EncuestasApiService,
    { provide: DateAdapter, useClass: CustomDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
    { provide: MAT_DATE_LOCALE, useValue: 'es-ES' },
  ],
})
export class EncuestasComponent implements OnInit {
  // Inyección moderna de FormBuilder
  private fb = inject(FormBuilder);
  public perfilSeleccionado: number = 2026;

  // Opcional: sanitizar nombres de hoja (máx 31 caracteres y sin caracteres raros)
private sanitizeSheetName(name: string): string {
  let clean = name.replace(/[\\\/\?\*\[\]\:]/g, ' ');
  if (clean.length > 31) {
    clean = clean.slice(0, 31);
  }
  return clean || 'Hoja';
}

downloadEstadisticasEstudiantilesExcel(): void {
  if (!this.estadisticasEstudiantiles || !this.estadisticasEstudiantiles.length) {
    this.mostrarError('No hay estadísticas para exportar.');
    return;
  }

  // Por si aún no se han calculado
  if (!this.totalEncuestasEstudiantiles) {
    this.computeEstadisticasEstudiantiles();
  }

  const wb = XLSX.utils.book_new();

  // Una hoja por grupo (I, II, III, etc.)
  this.estadisticasEstudiantiles.forEach((grupo) => {
    const columnas = this.getColumnasPorEscala(grupo.escala);

    // Encabezados
    const header = [
      'Aspecto a evaluar',
      ...columnas.map((c) => c.label),
      'Total encuestas',
    ];

    const data: any[][] = [];
    data.push(header);

    // Filas de datos
    grupo.preguntas.forEach((p) => {
      const row: any[] = [p.label];

      columnas.forEach((col) => {
        const conteo = (p.conteos && p.conteos[col.value]) || 0;
        row.push(conteo);
      });

      row.push(p.totalEncuestas);
      data.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      this.sanitizeSheetName(grupo.titulo)
    );
  });

  // Archivo final
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  saveAs(blob, 'estadisticas_encuestas_estudiantiles.xlsx');
}
downloadEstadisticasColaboradoresExcel(): void {
  if (!this.estadisticasColaboradores || !this.estadisticasColaboradores.length) {
    this.mostrarError('No hay estadísticas de colaboradores para exportar.');
    return;
  }

  if (!this.totalEncuestasColaboradores) {
    this.computeEstadisticasColaboradores();
  }

  const wb = XLSX.utils.book_new();

  this.estadisticasColaboradores.forEach((grupo) => {
    const columnas = this.getColumnasPorEscala(grupo.escala);

    const header = [
      'Aspecto a evaluar',
      ...columnas.map((c) => c.label),
      'Total encuestas',
    ];

    const data: any[][] = [header];

    grupo.preguntas.forEach((p) => {
      const row: any[] = [p.label];

      columnas.forEach((col) => {
        const conteo = (p.conteos && p.conteos[col.value]) || 0;
        row.push(conteo);
      });

      row.push(p.totalEncuestas);
      data.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, this.sanitizeSheetName(grupo.titulo));
  });

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  saveAs(blob, 'estadisticas_encuestas_colaboradores.xlsx');
}



  // Claves de preguntas abiertas que se pueden editar posteriormente
  private preguntasAbiertasEditablesKeys: string[] = [
    // ESTUDIANTIL
    'secIII_C.comentariosCentro',
    'secIV_S.mejoraRolTallerista',
    'secV.mejoraCoordinacion',
    'comentariosAdicionales',

    // COLABORADORES / JEFES
    'sugerencias',
    'cumplePerfilEgreso',
    'comentariosAdicionales',
  ];

  // === ESTADÍSTICAS ===
  totalEncuestasEstudiantiles = 0;
  totalEncuestasColaboradores = 0;
  tipoStatsVisible: TipoEncuesta | null = null;

  estadisticasEstudiantiles: {
    titulo: string;
    escala: TipoEscala;
    preguntas: EstadisticaPregunta[];
  }[] = [];

  estadisticasColaboradores: {
    titulo: string;
    escala: TipoEscala;
    preguntas: EstadisticaPregunta[];
  }[] = [];
  filtroAnioStats: number | null = null;
  filtroSemestreStats: number | null = null;
  filtroTipoStats: TipoEncuesta = 'ESTUDIANTIL';


  aniosDisponiblesStats: number[] = [];

  constructor(
    private snackBar: MatSnackBar,
    private encuestasApi: EncuestasApiService,
    private colaboradoresService: ColaboradoresService
  ) {}

  // Estado general de la UI
  public tipoRegistroActivo: TipoEncuesta | null = null;
  public selectedEncuesta: EncuestaRegistro | null = null;
  public encuestaEnEdicion: EncuestaRegistro | null = null;
  public isLoading: boolean = false;

  // Formulario de registro y lista de encuestas
  registroForm!: FormGroup;
  encuestas: EncuestaRegistro[] = [];

  // Catálogos para selects
  estudiantes: { rut: string; nombre: string }[] = [];
  centros: { id: number; nombre: string; comuna?: string; region?: string }[] = [];
  colaboradores: { id: number; nombre: string; rut?: string | null }[] = [];
  tutores: { id: number; nombre: string }[] = [];
  colaboradoresFiltrados: { id: number; nombre: string }[] = [];

  // Permite bloquear selects si se requiere
  public readOnlySelects = false;

  // Opciones para escalas y selects en formulario
  opcionesEscala5 = [
    { value: 'NA', label: 'NA' },
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 5, label: '5' },
  ];

  opcionesSiNo = [
    { value: 'SI', label: 'Sí' },
    { value: 'NO', label: 'No' },
  ];

  opcionesNormativas = [
    { value: 'SI', label: 'Sí' },
    { value: 'NO', label: 'No' },
    { value: 'NS', label: 'No existe / no sabe' },
  ];

  opcionesParticipacion = [
    { value: 'A_P', label: 'Asistí y pude participar' },
    { value: 'A_N', label: 'Asistí, pero no intervine' },
    { value: 'R_NA', label: 'Se realizó, pero no asistí' },
    { value: 'R_NI', label: 'Se realizó, pero no fui invitado' },
    { value: 'NR', label: 'No se realizó' },
  ];

  tiposEncuesta = [
    { value: 'ESTUDIANTIL' as TipoEncuesta, label: 'Percepción estudiantil' },
    {
      value: 'COLABORADORES_JEFES' as TipoEncuesta,
      label: 'Colaboradores / Jefes UTP',
    },
  ];

  // Mapea claves internas de preguntas a textos legibles para detalle/export
  private preguntaLabels: { [key: string]: string } = {
    // --- COLABORADORES / JEFES UTP ---

    // SECCION I
    'secI.e1_planificacion':
      'El profesor(a) en practica se rige por un sistema de planificacion que incluye calendarizaciones y planificacion semanal, la cual entrega en la fecha acordada.',
    'secI.e2_estructuraClase':
      'Durante la realizacion de la clase sigue una estructura definida.',
    'secI.e3_secuenciaActividades':
      'En las actividades que realiza hay una secuencia con introduccion, desarrollo y conclusion.',
    'secI.e4_preguntasAplicacion':
      'Durante la clase realiza preguntas de aplicacion de contenidos para verificar lo que los estudiantes han aprendido.',
    'secI.e5_estrategiasAtencion':
      'Utiliza distintas estrategias para captar la atencion de los estudiantes, ademas de demostrar dominio del contenido.',
    'secI.e6_retroalimentacion':
      'Entrega retroalimentacion a los estudiantes luego de sus intervenciones en clases.',
    'secI.e7_normasClase':
      'Establece las normas del curso o actividades a traves del dialogo y/o la negociacion con los estudiantes.',
    'secI.e8_usoTecnologia':
      'Usa la tecnologia para comunicarse con los estudiantes y promover su uso en sus presentaciones.',

    // SECCION II
    'secII.i1_vinculacionPares':
      'Establece vinculacion con sus pares y docentes del establecimiento y participa en actividades extracurriculares.',
    'secII.i2_capacidadGrupoTrabajo': 'Capacidad de participar en un grupo de trabajo.',
    'secII.i3_presentacionPersonal':
      'Presentacion personal acorde a lo requerido por el establecimiento, cumpliendo horarios.',
    'secII.i4_autoaprendizaje':
      'Existe un proceso de autoaprendizaje e iniciativa personal frente a la superacion de debilidades.',
    'secII.i5_formacionSuficiente':
      'La formacion recibida en la Universidad fue suficiente para el desempeno del profesor en su practica profesional.',

    // SECCION III
    'secIII.v1_flujoInformacionSupervisor':
      'Durante la practica se mantuvo flujo de informacion con el supervisor/tallerista asignado.',
    'secIII.v2_claridadRoles':
      'Existe claridad de los roles de supervisores o talleristas, profesores colaboradores y coordinadora de practica.',
    'secIII.v3_verificacionAvance':
      'La coordinadora verifica los estados de avance de los procesos de practica.',
    'secIII.v4_satisfaccionGeneral':
      'En general, se encuentra satisfecho con la informacion y el sistema de practicas de la carrera.',

    // Preguntas abiertas COLABORADORES
    sugerencias:
      'Tiene sugerencias o recomendaciones respecto a las practicas, practicantes y coordinacion de ellas que puedan generar mejoras en el futuro?',
    cumplePerfilEgreso: 'Cree que se cumple el perfil de egreso declarado?',
    comentariosAdicionales: 'Comentarios adicionales sobre la practica',

    // --- ESTUDIANTES ---
    'secI.objetivos': 'Los objetivos planteados para el nivel de practica desempenado.',
    'secI.accionesEstablecimiento':
      'Las acciones realizadas en el desarrollo de esta practica en los establecimientos educacionales.',
    'secI.accionesTaller':
      'Las acciones desarrolladas en las sesiones de taller en la universidad.',
    'secI.satisfaccionGeneral': 'El grado de satisfaccion general del proceso.',

    // ESTUDIANTIL - Sec II A (colaboradores) escala 1-5
    'secII_A.apoyoInsercion':
      'Apoyo la insercion al centro educativo en sus distintos niveles (espacios dentro del colegio, presentacion frente a estudiantes y colegas).',
    'secII_A.apoyoGestion':
      'Apoyo permanentemente la gestion educativa (planificacion, ejecucion y evaluacion) dentro y fuera del aula.',
    'secII_A.orientacionComportamiento':
      'Oriento el comportamiento y presentacion personal en el aula con un lenguaje formal y pertinente.',
    'secII_A.comunicacionConstante':
      'Mantuvo una comunicacion constante y oportuna, respecto a las actividades del establecimiento educacional.',
    'secII_A.retroalimentacionProceso':
      'Retroalimento el proceso de practica en sus distintas etapas, incentivando y facilitando la participacion del practicante.',

    // ESTUDIANTIL - Sec II B (colaboradores) select SI/NO
    'secII_B.interesRol': 'Se evidencio un interes por su rol como colaborador/a?',
    'secII_B.recomendarColaborador':
      'Usted recomendaria al colaborador/a para ser asignado en un futuro proceso de practica?',

    // ESTUDIANTIL - Sec III A (normativas)
    'secIII_A.planEvacuacion':
      'Plan Integral de Evacuacion y Seguridad Escolar Francisca Cooper (ex-DEYSE).',
    'secIII_A.proyectoEducativo': 'Proyecto Educativo Institucional.',
    'secIII_A.reglamentoConvivencia': 'Reglamento Interno de Convivencia Escolar.',
    'secIII_A.planMejoramiento': 'Plan de Mejoramiento Educativo.',

    // ESTUDIANTIL - Sec III B (participacion)
    'secIII_B.reunionesDepartamento': 'Reuniones de departamento de las asignaturas.',
    'secIII_B.reunionesApoderados': 'Reuniones de apoderados.',
    'secIII_B.fiestasPatrias': 'Celebracion de Fiestas Patrias.',
    'secIII_B.diaLibro': 'Dia del libro.',
    'secIII_B.aniversarios': 'Aniversarios.',
    'secIII_B.diaFamilia': 'Dia de la familia.',
    'secIII_B.graduaciones': 'Graduaciones.',

    // ESTUDIANTIL - Sec III C (percepcion centro)
    'secIII_C.gratoAmbiente': 'Percibe un grato ambiente en el centro educativo.',
    'secIII_C.recomendarCentro':
      'Recomendaria este centro educativo como centro de practicas?',
    'secIII_C.comentariosCentro': 'Comentarios adicionales sobre el centro educativo.',

    // ESTUDIANTIL - Sec IV T (tallerista)
    'secIV_T.presentacionCentro': 'Presento adecuadamente el centro educativo al estudiante en practica.',
    'secIV_T.facilitaComprension':
      'Facilito la comprension de las actividades a realizar en el centro.',
    'secIV_T.planificaVisitas':
      'Planifico visitas y acompanamientos al centro educativo.',
    'secIV_T.sesionesSemanales': 'Realizo sesiones semanales de seguimiento.',
    'secIV_T.evaluaPermanente': 'Evalua de manera permanente el avance del practicante.',
    'secIV_T.orientaDesempeno':
      'Oriento el desempeno del practicante con retroalimentacion concreta.',
    'secIV_T.organizaActividades':
      'Organizo actividades que apoyan el proceso de practica.',

    // ESTUDIANTIL - Sec IV S (supervisor)
    'secIV_S.presentacionCentro': 'Presento el centro educativo y sus responsables.',
    'secIV_S.orientaGestion':
      'Orienta en la gestion y procesos administrativos del centro.',
    'secIV_S.comunicacionConstante':
      'Mantiene comunicacion constante con el practicante.',
    'secIV_S.orientaComportamiento':
      'Orienta sobre comportamiento y protocolo dentro del centro.',
    'secIV_S.sesionesRetro': 'Realiza sesiones de retroalimentacion periodicas.',
    'secIV_S.evaluaGlobal': 'Evalua globalmente el desempeno del practicante.',
    'secIV_S.resuelveProblemas':
      'Ayuda a resolver problemas presentados en el centro.',
    'secIV_S.orientaGestionDos':
      'Propone mejoras para el rol del tallerista/supervisor.',
    'secIV_S.mejoraRolTallerista':
      'Sugiere mejoras para el rol del tallerista/supervisor.',

    // ESTUDIANTIL - Sec V (coordinacion practicas)
    'secV.induccionesAcordes':
      'Las inducciones iniciales fueron acordes a la practica.',
    'secV.informacionClara':
      'La informacion entregada por coordinacion fue clara.',
    'secV.respuestaDudas': 'Responde oportunamente las dudas planteadas.',
    'secV.infoAcordeCentros':
      'La informacion de centros disponibles fue pertinente.',
    'secV.gestionesMejora':
      'Se realizaron gestiones para mejorar mi experiencia en la practica.',
    'secV.mejoraCoordinacion':
      'Sugiere mejoras para la coordinacion de practicas.',
  };

    // Mapea claves de metadata a etiquetas legibles para el detalle
  metadataLabels: { [key: string]: string } = {
    // COLABORADORES / JEFES
    nombre_colaborador: 'Nombre del colaborador',
    nombre_colegio: 'Centro educativo',

    // ESTUDIANTIL
    nombre_estudiante: 'Nombre del estudiante',
    nombre_centro: 'Centro educativo',

    // Campos generales
    observacion: 'Observación',
    fecha: 'Fecha de evaluación',
    semestre: 'Semestre',
    tipo_practica: 'Tipo de práctica',
    semestreEncuesta: 'Semestre Encuesta',
    anioEncuesta: 'Año Encuesta',
  };

  mapMetadataLabel(key: string): string {
    // si existe en el mapa, usamos el texto bonito
    if (this.metadataLabels[key]) {
      return this.metadataLabels[key];
    }

    // fallback: reemplaza guiones bajos por espacios y pone mayúscula inicial
    const pretty = key.replace(/_/g, ' ');
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  }

  // Diccionarios para mostrar textos descriptivos en vez de códigos
  private escala5Texto: Record<string, string> = {
    NA: 'No aplica',
    '1': 'Muy insatisfecho',
    '2': 'Insatisfecho',
    '3': 'Neutral',
    '4': 'Satisfecho',
    '5': 'Muy satisfecho',
  };

  private siNoTexto: Record<string, string> = {
    SI: 'Sí',
    NO: 'No',
    NS: 'No existe / no sabe',
  };

  private participacionTexto: Record<string, string> = {
    A_P: 'Asistí y pude participar',
    A_N: 'Asistí, pero no intervine',
    R_NA: 'Se realizó, pero no asistí',
    R_NI: 'Se realizó, pero no fui invitado',
    NR: 'No se realizó',
  };

  private columnasEscala5 = [
    { value: 'NA', label: 'No aplica' },
    { value: '1', label: 'Muy insatisfecho' },
    { value: '2', label: 'Insatisfecho' },
    { value: '3', label: 'Ni insatisfecho ni satisfecho' },
    { value: '4', label: 'Satisfecho' },
    { value: '5', label: 'Muy satisfecho' },
  ];

  private columnasSiNo = [
    { value: 'SI', label: 'Sí' },
    { value: 'NO', label: 'No' },
  ];

  private columnasParticipacion = [
    { value: 'A_P', label: 'Asistí y pude participar' },
    { value: 'A_N', label: 'Asistí, pero no intervine' },
    { value: 'R_NA', label: 'Se realizó, pero no asistí' },
    { value: 'R_NI', label: 'Se realizó, pero no fui invitado' },
    { value: 'NR', label: 'No se realizó' },
  ];

  private columnasNormativas = [
  { value: 'SI', label: 'Sí' },
  { value: 'NO', label: 'No' },
  { value: 'NS', label: 'No existe / no sabe' },
];

  // Devuelve el texto legible para una pregunta
  mapPreguntaDescripcion(desc: string): string {
    return this.preguntaLabels[desc] ?? desc;
  }

  // Normaliza el valor de respuesta a un texto entendible para tablas/detalle
  mapRespuestaValor(value: any): string {
    if (value === null || value === undefined || value === '') {
      return 'Sin respuesta';
    }
    const asString = typeof value === 'number' ? value.toString() : String(value);
    const esNumero = ['1', '2', '3', '4', '5'].includes(asString);

    if (esNumero && this.escala5Texto[asString]) {
      return `${asString} - ${this.escala5Texto[asString]}`;
    }
    if (this.escala5Texto[asString]) {
      return this.escala5Texto[asString];
    }
    if (this.participacionTexto[asString]) {
      return this.participacionTexto[asString];
    }
    if (this.siNoTexto[asString]) {
      return this.siNoTexto[asString];
    }

    return asString;
  }

  // Ciclo de vida inicial: arma formulario base y carga datos
  ngOnInit(): void {
    this.registroForm = this.fb.group({});
    this.loadEncuestas();
    this.loadCatalogos();
  }

  // ---------- CARGA ENCUESTAS ----------
  // Obtiene encuestas desde la API y las adapta al modelo EncuestaRegistro
  loadEncuestas(): void {
    this.isLoading = true;
    this.encuestasApi.getEncuestasRegistradas().subscribe({
      next: (data: ApiEncuesta[]) => {
        this.encuestas = (data as any[]).map((item) => {
          const { respuestas, tipo, ...rest } = item;

          // Si tu backend incluye la relación "semestre" (por include: { semestre: true })
          const semestreRelacion = (item as any).semestre as
            | { anio: number; semestre: number }
            | null
            | undefined;

          const fechaObj = item.fecha ? new Date(item.fecha) : new Date();

          // Definimos tipo por presencia de nombre_estudiante
          const tipoInferido: TipoEncuesta =
            (item as any).nombre_estudiante
              ? 'ESTUDIANTIL'
              : 'COLABORADORES_JEFES';

          // Año y semestre "oficiales" de la encuesta
          const anioEncuesta =
            semestreRelacion?.anio ?? (fechaObj ? fechaObj.getFullYear() : null);

          const semestreCalculado = this.computeSemestre(fechaObj);
          const semestreEncuesta =
            semestreRelacion?.semestre ??
            (typeof semestreCalculado === 'number' ? semestreCalculado : null);

          // Convertir ID del colaborador opcional a nombre (si existe)
          if (rest['nombre_docente_colaborador_opcional']) {
            const col = this.colaboradores.find(
              (c) =>
                c.id ===
                Number(rest['nombre_docente_colaborador_opcional'])
            );
            if (col) {
              rest['nombre_docente_colaborador_opcional'] = col.nombre;
            }
          }

          return {
            id: (item.id ?? Math.random()).toString(),
            tipo: tipoInferido,
            fecha: fechaObj,
            origenArchivo: (item as any).origenArchivo ?? '',
            metadata: {
              ...rest,
              fecha: fechaObj,
              anioEncuesta,
              semestreEncuesta,
            },
            respuestas: (respuestas as any[]) || [],
          } as EncuestaRegistro;
        });

        // Recalcular opciones de años disponibles para el filtro
        this.recalcularOpcionesFiltroStats();

        this.isLoading = false;

        // Si ya hay un tipo de estadísticas visible, lo recalculamos
        if (this.tipoStatsVisible === 'ESTUDIANTIL') {
          this.computeEstadisticasEstudiantiles();
        } else if (this.tipoStatsVisible === 'COLABORADORES_JEFES') {
          this.computeEstadisticasColaboradores();
        }
      },
      error: (err) => {
        console.error('Error al cargar encuestas', err);
        this.mostrarError('No fue posible cargar las encuestas.');
        this.isLoading = false;
      },
    });
  }

  // Recalcula los años disponibles para filtrar estadísticas
  private recalcularOpcionesFiltroStats(): void {
    const setAnios = new Set<number>();

    this.encuestas.forEach((e) => {
      const meta = e.metadata || {};
      const anio: number | null =
        meta['anioEncuesta'] ?? (e.fecha ? e.fecha.getFullYear() : null);

      if (anio) {
        setAnios.add(anio);
      }
    });

    this.aniosDisponiblesStats = Array.from(setAnios).sort((a, b) => b - a);
  }


  // Devuelve solo las encuestas que cumplan con el año / semestre elegidos
  private filtrarPorSemestreYAnio(
    encuestas: EncuestaRegistro[]
  ): EncuestaRegistro[] {
    return encuestas.filter((e) => {
      const meta = e.metadata || {};

      const anio: number | null =
        meta['anioEncuesta'] ?? (e.fecha ? e.fecha.getFullYear() : null);
      const semestre: number | null =
        meta['semestreEncuesta'] ?? this.computeSemestre(e.fecha as Date);

      if (this.filtroAnioStats !== null && anio !== this.filtroAnioStats) {
        return false;
      }

      if (
        this.filtroSemestreStats !== null &&
        semestre !== this.filtroSemestreStats
      ) {
        return false;
      }

      return true;
    });
  }




  // ---------- CARGA CATÁLOGOS ----------
  // Carga en paralelo estudiantes, centros, colaboradores y tutores
  loadCatalogos(): void {
  this.isLoading = true;
  forkJoin({
    estudiantes: this.encuestasApi.getEstudiantes(),
    centros: this.encuestasApi.getCentros(),
    // usamos el servicio que trae rut
    colaboradoresResp: this.colaboradoresService.listar({ limit: 999 }),
    tutores: this.encuestasApi.getTutores(),
  }).subscribe({
    next: ({ estudiantes, centros, colaboradoresResp, tutores }) => {
      this.estudiantes = estudiantes || [];
      this.centros = centros || [];
      // el endpoint de colaboradoresService devuelve { items: Colaborador[] }
      this.colaboradores = (colaboradoresResp?.items || []).map(c => ({
        id: c.id,
        nombre: c.nombre,
        rut: c.rut,
      }));
      this.tutores = tutores || [];
      this.isLoading = false;
    },
    error: (err) => {
      console.error('Error cargando catálogos', err);
      this.mostrarError(
        'No fue posible cargar catálogos (estudiantes/centros/colaboradores).'
      );
      this.isLoading = false;
    },
  });
}


  // ---------- FORM BUILDERS ----------
  // Construye formulario para encuesta estudiantil
  private buildEstudiantilForm(): FormGroup {
    const anioActual = new Date().getFullYear();
    return this.fb.group({
      anioEncuesta: [anioActual, Validators.required],
      semestreEncuesta: [1, Validators.required],
      nombreEstudiante: ['', Validators.required],
      establecimiento: ['', Validators.required],
      fechaEvaluacion: [null, Validators.required],
      nombreTalleristaSupervisor: ['', Validators.required],
      nombreDocenteColaborador: ['', Validators.required],
      tipoPractica: ['', Validators.required],
      colaboradorAdicional: [null],


      secI: this.fb.group({
        objetivos: ['', Validators.required],
        accionesEstablecimiento: ['', Validators.required],
        accionesTaller: ['', Validators.required],
        satisfaccionGeneral: ['', Validators.required],
      }),

      secII_A: this.fb.group({
        apoyoInsercion: ['', Validators.required],
        apoyoGestion: ['', Validators.required],
        orientacionComportamiento: ['', Validators.required],
        comunicacionConstante: ['', Validators.required],
        retroalimentacionProceso: ['', Validators.required],
      }),

      secII_B: this.fb.group({
        interesRol: ['', Validators.required],
        recomendarColaborador: ['', Validators.required],
        comentariosColaborador: [''], // opcional
      }),

      secIII_A: this.fb.group({
        planEvacuacion: ['', Validators.required],
        proyectoEducativo: ['', Validators.required],
        reglamentoConvivencia: ['', Validators.required],
        planMejoramiento: ['', Validators.required],
      }),

      secIII_B: this.fb.group({
        reunionesDepartamento: ['', Validators.required],
        reunionesApoderados: ['', Validators.required],
        fiestasPatrias: ['', Validators.required],
        diaLibro: ['', Validators.required],
        aniversarios: ['', Validators.required],
        diaFamilia: ['', Validators.required],
        graduaciones: ['', Validators.required],
      }),

      secIII_C: this.fb.group({
        gratoAmbiente: ['', Validators.required],
        recomendarCentro: ['', Validators.required],
        comentariosCentro: [''], // opcional
      }),

      secIV_T: this.fb.group({
        presentacionCentro: ['', Validators.required],
        facilitaComprension: ['', Validators.required],
        planificaVisitas: ['', Validators.required],
        sesionesSemanales: ['', Validators.required],
        evaluaPermanente: ['', Validators.required],
        orientaDesempeno: ['', Validators.required],
        organizaActividades: ['', Validators.required],
      }),

      secIV_S: this.fb.group({
        presentacionCentro: ['', Validators.required],
        orientaGestion: ['', Validators.required],
        comunicacionConstante: ['', Validators.required],
        orientaComportamiento: ['', Validators.required],
        sesionesRetro: ['', Validators.required],
        evaluaGlobal: ['', Validators.required],
        resuelveProblemas: ['', Validators.required],
        orientaGestionDos: ['', Validators.required],
        mejoraRolTallerista: [''], // comentario abierto opcional
      }),

      secV: this.fb.group({
        induccionesAcordes: ['', Validators.required],
        informacionClara: ['', Validators.required],
        respuestaDudas: ['', Validators.required],
        infoAcordeCentros: ['', Validators.required],
        gestionesMejora: ['', Validators.required],
        mejoraCoordinacion: [''], // abierto opcional
      }),

      comentariosAdicionales: [''], // opcional
    });
  }


  // Construye formulario para encuesta de colaboradores / jefes UTP
  private buildColaboradoresForm(): FormGroup {
    return this.fb.group({
      anioEncuesta: [anioActual, Validators.required],
      semestreEncuesta: [1, Validators.required],
      nombreColaborador: ['', Validators.required],
      nombreEstudiantePractica: ['', Validators.required],
      centroEducativo: ['', Validators.required],
      fechaEvaluacion: [null, Validators.required],
      tipoPractica: ['', Validators.required],

      secI: this.fb.group({
        e1_planificacion: ['', Validators.required],
        e2_estructuraClase: ['', Validators.required],
        e3_secuenciaActividades: ['', Validators.required],
        e4_preguntasAplicacion: ['', Validators.required],
        e5_estrategiasAtencion: ['', Validators.required],
        e6_retroalimentacion: ['', Validators.required],
        e7_normasClase: ['', Validators.required],
        e8_usoTecnologia: ['', Validators.required],
      }),

      secII: this.fb.group({
        i1_vinculacionPares: ['', Validators.required],
        i2_capacidadGrupoTrabajo: ['', Validators.required],
        i3_presentacionPersonal: ['', Validators.required],
        i4_autoaprendizaje: ['', Validators.required],
        i5_formacionSuficiente: ['', Validators.required],
      }),

      secIII: this.fb.group({
        v1_flujoInformacionSupervisor: ['', Validators.required],
        v2_claridadRoles: ['', Validators.required],
        v3_verificacionAvance: ['', Validators.required],
        v4_satisfaccionGeneral: ['', Validators.required],
      }),

      sugerencias: [''],           // opcional
      cumplePerfilEgreso: [''],   // opcional
      comentariosAdicionales: [''] // opcional
    });
  }

  

  // ---------- UI / FORM CONTROL ----------
  // Inicializa el formulario según el tipo de encuesta
  iniciarRegistro(tipo: TipoEncuesta): void {
    this.requestCloseSidenav();
    this.tipoRegistroActivo = tipo;
    this.selectedEncuesta = null;
    this.perfilSeleccionado = 2026;

    if (tipo === 'ESTUDIANTIL') {
      this.registroForm = this.buildEstudiantilForm();
      this.filtrarColaboradores(null);

      // Cuando cambia el colaborador principal → actualizar lista del adicional
      this.registroForm.get('nombreDocenteColaborador')?.valueChanges.subscribe(val => {
        this.filtrarColaboradores(val);
      });
      

      // Valores por defecto opcionales
      if (this.estudiantes.length) {
        this.registroForm.patchValue({
          nombreEstudiante: this.estudiantes[0].rut,
        });
      }
      if (this.centros.length) {
        this.registroForm.patchValue({ establecimiento: this.centros[0].id });
      }
    } else {
      this.registroForm = this.buildColaboradoresForm();
      if (this.colaboradores.length) {
        this.registroForm.patchValue({
          nombreColaborador: this.colaboradores[0].id,
        });
      }
      if (this.centros.length) {
        this.registroForm.patchValue({
          centroEducativo: this.centros[0].id,
        });
      }
    }

    if (this.readOnlySelects) {
      this.disableSelectControls();
    }
  }

  private filtrarColaboradores(colaboradorPrincipalId: number | null) {
  this.colaboradoresFiltrados = this.colaboradores.filter(
    col => col.id !== colaboradorPrincipalId
  );
}


  // Deshabilita controles select cuando se requiere modo solo lectura
  private disableSelectControls(): void {
    const controls = [
      'nombreEstudiante',
      'establecimiento',
      'nombreTalleristaSupervisor',
      'nombreDocenteColaborador',
      'nombreColaborador',
      'nombreEstudiantePractica',
      'centroEducativo',
    ];
    controls.forEach((c) => {
      const ctrl = this.registroForm.get(c);
      if (ctrl) ctrl.disable();
    });
  }

  private requestCloseSidenav(): void {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('app:close-sidenav'));
    }
  }

  // Cierra modal de registro y resetea formulario
  cerrarRegistro(): void {
    this.tipoRegistroActivo = null;
    if (this.registroForm) this.registroForm.reset();
  }

  // Abre modal de detalle de una encuesta
  verDetalles(encuesta: EncuestaRegistro): void {
    this.requestCloseSidenav();
    this.selectedEncuesta = encuesta;
    this.tipoRegistroActivo = null;
  }

  // Abre modal de edición de preguntas abiertas (clonando objeto)
  editarEncuesta(encuesta: EncuestaRegistro): void {
    this.requestCloseSidenav();
    this.encuestaEnEdicion = JSON.parse(JSON.stringify(encuesta));
    this.selectedEncuesta = null;
  }

  // Cierra edición sin guardar
  cancelarEdicion(): void {
    this.encuestaEnEdicion = null;
  }

  // Cierra modal de detalles
  cerrarDetalles(): void {
    this.selectedEncuesta = null;
  }

  // Guarda solo respuestas abiertas editables para la encuesta seleccionada
  guardarEdicionAbiertas(): void {
    if (!this.encuestaEnEdicion) return;

    const respuestas = this.respuestasAbiertasEditables.map((r) => ({
      preguntaId: r.preguntaId,
      respuestaAbierta: r.respuestaAbierta ?? '',
    }));

    this.isLoading = true;

    this.encuestasApi
      .actualizarRespuestasAbiertas(this.encuestaEnEdicion.id, { respuestas })
      .subscribe({
        next: () => {
          this.mostrarOk('Respuestas abiertas actualizadas correctamente.');
          this.encuestaEnEdicion = null;
          this.loadEncuestas();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error al actualizar respuestas abiertas', err);
          const msg =
            err?.error?.message ??
            `Error ${err.status} al actualizar respuestas.`;
          this.mostrarError(msg);
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
        },
      });
  }

  // Devuelve etiqueta legible para el tipo de encuesta
  mapTipoLabel(tipo: TipoEncuesta | string): string {
    const found = this.tiposEncuesta.find((t) => t.value === tipo);
    return found ? found.label : (tipo as string);
  }

  // Obtiene nombre del estudiante a partir del rut (para mostrar en lista)
  getNombreEstudiantePorRut(rut: string | null | undefined): string {
    if (!rut) return '';
    const est = this.estudiantes.find((e) => e.rut === rut);
    return est ? est.nombre : '';
  }
  getRutColaboradorPorNombre(nombre: string | null | undefined): string {
  if (!nombre) return '';
  const col = this.colaboradores.find(c => c.nombre === nombre);
  return this.formatRut(col?.rut);
  }




  terminoBusqueda: string = '';

  // Configuración de orden actual en tabla de encuestas
  orden = {
    campo: 'fecha' as 'fecha' | 'nombre' | 'tipo',
    asc: false,
  };

  // Cambia campo y dirección de orden
  ordenarPor(campo: 'fecha' | 'nombre' | 'tipo') {
    if (this.orden.campo === campo) {
      this.orden.asc = !this.orden.asc;
    } else {
      this.orden.campo = campo;
      this.orden.asc = true;
    }
  }

  // ===== FILTRO + ORDEN =====
  // Retorna lista filtrada y ordenada, usada directamente en el template
  get encuestasFiltradas(): EncuestaRegistro[] {
    let lista = [...this.encuestas];

    // --- FILTRO ---
    if (this.terminoBusqueda && this.terminoBusqueda.trim()) {
      const termino = this.terminoBusqueda.trim().toLowerCase();
      const terminoSinPuntos = termino.replace(/\./g, '');


      lista = lista.filter((e) => {
        const meta = e.metadata || {};

        // Para encuestas estudiantiles
        const rutEstudiante = (meta['nombre_estudiante'] || '')
          .toString()
          .toLowerCase();
        const rutEstudianteSinPuntos = rutEstudiante.replace(/\./g, '');
        const nombreEstudiante = (
          this.getNombreEstudiantePorRut(meta['nombre_estudiante']) || ''
        )
          .toString()
          .toLowerCase();


        // Para encuestas de colaboradores
        const rutColaborador = (
          this.getRutColaboradorPorNombre(meta['nombre_colaborador']) || ''
        ).toLowerCase();
        const rutColaboradorSinPuntos = rutColaborador.replace(/\./g, '');
        const nombreColaborador = (meta['nombre_colaborador'] || '')
          .toString()
          .toLowerCase();


        // Nombre del centro
        const nombreCentro = (
          meta['nombre_centro'] ||
          meta['nombre_colegio'] ||
          ''
        )
          .toString()
          .toLowerCase();

        // Tipo de encuesta en texto
        const tipoLabel = (this.mapTipoLabel(e.tipo) || '').toLowerCase();

        // Fecha de la encuesta
        const fechaStr = e.fecha
          ? new Date(e.fecha).toISOString().slice(0, 10).toLowerCase()
          : '';

        return (
          rutEstudiante.includes(termino) ||
          rutEstudianteSinPuntos.includes(terminoSinPuntos) ||
          nombreEstudiante.includes(termino) ||
          rutColaborador.includes(termino) ||
          rutColaboradorSinPuntos.includes(terminoSinPuntos) ||
          nombreColaborador.includes(termino) ||
          nombreCentro.includes(termino) ||
          tipoLabel.includes(termino) ||
          fechaStr.includes(termino)
        );
      });
    }

    // --- ORDEN ---
    lista.sort((a, b) => {
      const asc = this.orden.asc ? 1 : -1;

      switch (this.orden.campo) {
        case 'fecha': {
          const fa = a.fecha ? a.fecha.getTime() : 0;
          const fb = b.fecha ? b.fecha.getTime() : 0;
          return asc * (fa - fb);
        }

        case 'nombre': {
          const metaA = a.metadata || {};
          const metaB = b.metadata || {};

          const nombreA =
            this.getNombreEstudiantePorRut(metaA['nombre_estudiante']) ||
            metaA['nombre_colaborador'] ||
            '';
          const nombreB =
            this.getNombreEstudiantePorRut(metaB['nombre_estudiante']) ||
            metaB['nombre_colaborador'] ||
            '';

          return asc * nombreA.localeCompare(nombreB);
        }

        case 'tipo': {
          const tipoA = this.mapTipoLabel(a.tipo);
          const tipoB = this.mapTipoLabel(b.tipo);
          return asc * tipoA.localeCompare(tipoB);
        }
      }

      return 0;
    });

    return lista;
  }

  // Hook para cambios de filtro
  onFiltersChange() {
    // Por ahora no hace nada extra
  }

    // Se llama cuando cambian los selects de año / semestre de estadísticas
  onFiltroStatsChange(): void {
    if (this.tipoStatsVisible === 'ESTUDIANTIL') {
      this.computeEstadisticasEstudiantiles();
    } else if (this.tipoStatsVisible === 'COLABORADORES_JEFES') {
      this.computeEstadisticasColaboradores();
    }
  }

  onVerEstadisticas(): void {
    if (!this.filtroTipoStats) return;
    this.requestCloseSidenav();
    this.mostrarEstadisticas(this.filtroTipoStats);
  }



  // Columnas de metadatos a mostrar en tabla de detalle (oculta campos técnicos)
  getDetailColumns(encuesta: EncuestaRegistro | null): string[] {
    if (!encuesta || !encuesta.metadata) return [];
    const ocultar = new Set(['respuestas', 'tipo', 'id', 'semestreId', 'semestre']);
    return Object.keys(encuesta.metadata).filter((k) => !ocultar.has(k));
  }

  getColumnasPorEscala(escala: TipoEscala) {
  switch (escala) {
    case 'ESCALA5':
      return this.columnasEscala5;
    case 'SI_NO':
      return this.columnasSiNo;
    case 'PARTICIPACION':
      return this.columnasParticipacion;
    case 'NORMATIVAS':
      return this.columnasNormativas;
  }
}



  // Retorna solo respuestas abiertas que son editables según configuración
  get respuestasAbiertasEditables() {
    if (!this.encuestaEnEdicion) return [];

    return this.encuestaEnEdicion.respuestas.filter((r) => {
      if (r.respuestaAbierta === undefined || r.respuestaAbierta === null) {
        return false;
      }

      const key = r.pregunta?.descripcion;
      if (!key) return false;

      return this.preguntasAbiertasEditablesKeys.includes(key);
    });
  }

  // Calcula semestre (1 o 2) según la fecha de la encuesta
  private computeSemestre(fecha: Date | null | undefined): number | '' {
    if (!fecha || isNaN(fecha.getTime())) return '';
    const month = fecha.getMonth(); // 0-based
    return month <= 6 ? 1 : 2; // enero (0) a julio (6) es semestre 1
  }

  // Formatea un RUT a formato 12.345.678-9
private formatRut(rut: string | null | undefined): string {
  if (!rut) return '';
  // dejar solo números y K
  const limpio = rut.replace(/[^0-9kK]/g, '');
  if (limpio.length < 2) return rut;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  const cuerpoFmt = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpoFmt}-${dv}`;
}


  // Construye los conteos para una pregunta dada en un conjunto de encuestas ESTUDIANTILES
  private buildEstadisticaPregunta(
  encuestas: EncuestaRegistro[],
  key: string,
  escala: TipoEscala
): EstadisticaPregunta {
    const conteos: { [valor: string]: number } = {};
    const totalEncuestas = encuestas.length;

    for (const e of encuestas) {
      const r = e.respuestas.find(
        (res) => res.pregunta?.descripcion === key
      );
      if (!r) continue;

      const raw =
        r.alternativa?.descripcion ??
        (typeof r.respuestaAbierta === 'string' ? r.respuestaAbierta.trim() : '');

      if (!raw) continue;

      const valor = String(raw);
      conteos[valor] = (conteos[valor] || 0) + 1;
    }

    return {
      key,
      label: this.mapPreguntaDescripcion(key),
      escala,
      conteos,
      totalEncuestas,
    };
  }


  


  // Devuelve el porcentaje de respuestas de una categoría (redondeado)
getPorcentaje(pregunta: any, valor: string): number {
  const total = pregunta?.totalEncuestas || 0;
  if (!total) {
    return 0;
  }

  const conteo = (pregunta.conteos && pregunta.conteos[valor]) || 0;
  return Math.round((conteo * 100) / total);
}


  // Botón para mostrar / ocultar estadísticas
mostrarEstadisticas(tipo: TipoEncuesta): void {
  // Si haces clic de nuevo en el mismo botón, se oculta (toggle)
  if (this.tipoStatsVisible === tipo) {
    this.tipoStatsVisible = null;
    return;
  }

  this.tipoStatsVisible = tipo;

  if (tipo === 'ESTUDIANTIL') {
    this.computeEstadisticasEstudiantiles();
  } else if (tipo === 'COLABORADORES_JEFES') {
    this.computeEstadisticasColaboradores();
  }
}



  // Cierra la ventana/modal de estadísticas
  cerrarEstadisticas(): void {
    this.tipoStatsVisible = null;
  }


  // Calcula todas las estadísticas para la encuesta ESTUDIANTIL
   // Calcula todas las estadísticas para la encuesta ESTUDIANTIL
private computeEstadisticasEstudiantiles(): void {
  const encuestasEstTodas = this.encuestas.filter(
    (e) => e.tipo === 'ESTUDIANTIL'
  );

  const encuestasEst = this.filtrarPorSemestreYAnio(encuestasEstTodas);

  this.totalEncuestasEstudiantiles = encuestasEst.length;
  this.estadisticasEstudiantiles = [];

  if (!encuestasEst.length) {
    return;
  }

  // === GRUPO 1: Perspectiva general de la práctica ===
  const grupoPerspectiva = {
    titulo: 'I. Perspectiva general desarrollo de la práctica',
    escala: 'ESCALA5' as TipoEscala,
    preguntas: [
      'secI.objetivos',
      'secI.accionesEstablecimiento',
      'secI.accionesTaller',
      'secI.satisfaccionGeneral',
    ].map((key) =>
      this.buildEstadisticaPregunta(encuestasEst, key, 'ESCALA5')
    ),
  };

  // === GRUPO 2: Percepción sobre colaboradores ===
  const grupoColaboradores = {
    titulo: 'II. Percepción sobre colaboradores(as)',
    escala: 'ESCALA5' as TipoEscala,
    preguntas: [
      'secII_A.apoyoInsercion',
      'secII_A.apoyoGestion',
      'secII_A.orientacionComportamiento',
      'secII_A.comunicacionConstante',
      'secII_A.retroalimentacionProceso',
    ].map((key) =>
      this.buildEstadisticaPregunta(encuestasEst, key, 'ESCALA5')
    ),
  };

  // === GRUPO 3: Experiencia con colaborador ===
  const grupoExperienciaColaborador = {
    titulo: 'III. Experiencia con colaborador(a)',
    escala: 'SI_NO' as TipoEscala,
    preguntas: [
      'secII_B.interesRol',
      'secII_B.recomendarColaborador',
    ].map((key) =>
      this.buildEstadisticaPregunta(encuestasEst, key, 'SI_NO')
    ),
  };

  // === GRUPO 4: Normativas del centro educativo ===
  const grupoNormativas = {
    titulo: 'IV. Normativas del centro educativo de práctica',
    escala: 'NORMATIVAS' as TipoEscala,
    preguntas: [
      'secIII_A.planEvacuacion',
      'secIII_A.proyectoEducativo',
      'secIII_A.reglamentoConvivencia',
      'secIII_A.planMejoramiento',
    ].map((key) =>
      this.buildEstadisticaPregunta(encuestasEst, key, 'NORMATIVAS')
    ),
  };

  // === GRUPO 5: Participación en actividades del establecimiento ===
  const grupoParticipacion = {
    titulo: 'V. Participación en actividades del establecimiento',
    escala: 'PARTICIPACION' as TipoEscala,
    preguntas: [
      'secIII_B.reunionesDepartamento',
      'secIII_B.reunionesApoderados',
      'secIII_B.fiestasPatrias',
      'secIII_B.diaLibro',
      'secIII_B.aniversarios',
      'secIII_B.diaFamilia',
      'secIII_B.graduaciones',
    ].map((key) =>
      this.buildEstadisticaPregunta(encuestasEst, key, 'PARTICIPACION')
    ),
  };

  // === GRUPO 6: Percepción sobre el centro educativo ===
  const grupoPercepcionCentro = {
    titulo: 'VI. Percepción sobre el centro educativo',
    escala: 'SI_NO' as TipoEscala,
    preguntas: [
      'secIII_C.gratoAmbiente',
      'secIII_C.recomendarCentro',
    ].map((key) =>
      this.buildEstadisticaPregunta(encuestasEst, key, 'SI_NO')
    ),
  };

  // === GRUPO 7: Percepción sobre el Tallerista ===
  const grupoTallerista = {
    titulo: 'VII. Percepción sobre el Tallerista',
    escala: 'ESCALA5' as TipoEscala,
    preguntas: [
      'secIV_T.presentacionCentro',
      'secIV_T.facilitaComprension',
      'secIV_T.planificaVisitas',
      'secIV_T.sesionesSemanales',
      'secIV_T.evaluaPermanente',
      'secIV_T.orientaDesempeno',
      'secIV_T.organizaActividades',
    ].map((key) =>
      this.buildEstadisticaPregunta(encuestasEst, key, 'ESCALA5')
    ),
  };

  // === GRUPO 8: Percepción sobre el Supervisor/a ===
  const grupoSupervisor = {
    titulo: 'VIII. Percepción sobre el Supervisor/a',
    escala: 'ESCALA5' as TipoEscala,
    preguntas: [
      'secIV_S.presentacionCentro',
      'secIV_S.orientaGestion',
      'secIV_S.comunicacionConstante',
      'secIV_S.orientaComportamiento',
      'secIV_S.sesionesRetro',
      'secIV_S.evaluaGlobal',
      'secIV_S.resuelveProblemas',
      'secIV_S.orientaGestionDos',
    ].map((key) =>
      this.buildEstadisticaPregunta(encuestasEst, key, 'ESCALA5')
    ),
  };

  // === GRUPO 9: Sobre la Coordinación de Prácticas ===
  const grupoCoordinacion = {
    titulo: 'IX. Sobre la Coordinación de Prácticas',
    escala: 'ESCALA5' as TipoEscala,
    preguntas: [
      'secV.induccionesAcordes',
      'secV.informacionClara',
      'secV.respuestaDudas',
      'secV.infoAcordeCentros',
      'secV.gestionesMejora',
    ].map((key) =>
      this.buildEstadisticaPregunta(encuestasEst, key, 'ESCALA5')
    ),
  };

  this.estadisticasEstudiantiles = [
    grupoPerspectiva,
    grupoColaboradores,
    grupoExperienciaColaborador,
    grupoNormativas,
    grupoParticipacion,
    grupoPercepcionCentro,
    grupoTallerista,
    grupoSupervisor,
    grupoCoordinacion,
  ];
}


// Calcula todas las estadísticas para la encuesta COLABORADORES_JEFES
private computeEstadisticasColaboradores(): void {
  const encuestasColTodas = this.encuestas.filter(
    (e) => e.tipo === 'COLABORADORES_JEFES'
  );

  const encuestasCol = this.filtrarPorSemestreYAnio(encuestasColTodas);

  this.totalEncuestasColaboradores = encuestasCol.length;
  this.estadisticasColaboradores = [];

  if (!encuestasCol.length) {
    return;
  }

  // Grupo I: Evaluación al Docente en Práctica
  const grupoDocente = {
    titulo: 'I. Evaluación al Docente en Práctica',
    escala: 'ESCALA5' as TipoEscala,
    preguntas: [
      'secI.e1_planificacion',
      'secI.e2_estructuraClase',
      'secI.e3_secuenciaActividades',
      'secI.e4_preguntasAplicacion',
      'secI.e5_estrategiasAtencion',
      'secI.e6_retroalimentacion',
      'secI.e7_normasClase',
      'secI.e8_usoTecnologia',
    ].map((key) =>
      this.buildEstadisticaPregunta(encuestasCol, key, 'ESCALA5')
    ),
  };

  // Grupo II: Integración a la comunidad educativa
  const grupoIntegracion = {
    titulo: 'II. Integración a la comunidad educativa',
    escala: 'ESCALA5' as TipoEscala,
    preguntas: [
      'secII.i1_vinculacionPares',
      'secII.i2_capacidadGrupoTrabajo',
      'secII.i3_presentacionPersonal',
      'secII.i4_autoaprendizaje',
      'secII.i5_formacionSuficiente',
    ].map((key) =>
      this.buildEstadisticaPregunta(encuestasCol, key, 'ESCALA5')
    ),
  };

  // Grupo III: Vinculación con la Coordinación de las Prácticas
  const grupoVinculacion = {
    titulo: 'III. Vinculación con la Coordinación de las Prácticas',
    escala: 'ESCALA5' as TipoEscala,
    preguntas: [
      'secIII.v1_flujoInformacionSupervisor',
      'secIII.v2_claridadRoles',
      'secIII.v3_verificacionAvance',
      'secIII.v4_satisfaccionGeneral',
    ].map((key) =>
      this.buildEstadisticaPregunta(encuestasCol, key, 'ESCALA5')
    ),
  };

  this.estadisticasColaboradores = [
    grupoDocente,
    grupoIntegracion,
    grupoVinculacion,
  ];
}



  // ---------- ENVÍO ----------
  // Envía el formulario a la API según el tipo de encuesta
  onSubmitRegistro(): void {
    if (!this.registroForm) return;
    if (!this.tipoRegistroActivo) {
      this.mostrarError('No hay tipo de encuesta activo.');
      return;
    }

    const form = this.registroForm;
    const raw = form.getRawValue ? form.getRawValue() : form.value;

    if (form.invalid) {
      form.markAllAsTouched();
      this.mostrarError('Por favor completa los campos requeridos.');
      return;
    }

    this.isLoading = true;

    const anioEncuesta = raw.anioEncuesta;
    const semestreEncuesta = raw.semestreEncuesta;

    let payload: any = {
      tipo: this.tipoRegistroActivo,
      data: { },
      semestre: {
        anio: raw.anioEncuesta, 
        semestre: raw.semestreEncuesta,
      },
    };

    if (this.tipoRegistroActivo === 'ESTUDIANTIL') {
      const data = raw;

      const estudianteRut: string = data.nombreEstudiante;
      const estudianteNombre =
        this.estudiantes.find((s) => s.rut === estudianteRut)?.nombre ?? null;
      const centroId = data.establecimiento;
      const centroNombre =
        this.centros.find((c) => c.id === centroId)?.nombre ?? null;
      const tutorId = data.nombreTalleristaSupervisor;
      const tutorNombre =
        this.tutores.find((t) => t.id === tutorId)?.nombre ?? null;
      const colaboradorId = data.nombreDocenteColaborador;
      const colaboradorNombre =
        this.colaboradores.find((c) => c.id === colaboradorId)?.nombre ?? null;

      payload.data = {
        nombreEstudiante: estudianteRut,
        nombreEstudianteLabel: estudianteNombre,
        establecimiento: centroNombre,
        establecimientoId: centroId,
        fechaEvaluacion: data.fechaEvaluacion
          ? new Date(data.fechaEvaluacion).toISOString()
          : new Date().toISOString(),

        tipo_practica: data.tipoPractica,
        nombre_docente_colaborador_opcional: data.colaboradorAdicional,
        nombreTalleristaSupervisor: tutorNombre,
        nombreTalleristaSupervisorId: tutorId,

        nombreDocenteColaborador: colaboradorNombre,
        nombreDocenteColaboradorId: colaboradorId,

        secI: data.secI,
        secII_A: data.secII_A,
        secII_B: data.secII_B,
        secIII_A: data.secIII_A,
        secIII_B: data.secIII_B,
        secIII_C: data.secIII_C,
        secIV_T: data.secIV_T,
        secIV_S: data.secIV_S,
        secV: data.secV,

        mejoraRolTallerista: data.secIV_S.mejoraRolTallerista,
        mejoraCoordinacion: data.comentariosAdicionales,

        comentariosAdicionales: data.comentariosAdicionales,
      };
    } else {
      // COLABORADORES_JEFES
      const data = raw;

      const colaboradorId = data.nombreColaborador;
      const colaboradorNombre =
        this.colaboradores.find((c) => c.id === colaboradorId)?.nombre ?? null;
      const estudianteRut = data.nombreEstudiantePractica;
      const estudianteNombre =
        this.estudiantes.find((s) => s.rut === estudianteRut)?.nombre ?? null;
      const centroId = data.centroEducativo;
      const centroNombre =
        this.centros.find((c) => c.id === centroId)?.nombre ?? null;

      payload.data = {
        nombreColaborador: colaboradorNombre,
        nombreColaboradorId: colaboradorId,
        nombreEstudiantePractica: estudianteRut,
        nombreEstudiantePracticaLabel: estudianteNombre,
        centroEducativo: centroNombre,
        centroEducativoId: centroId,
        fechaEvaluacion: data.fechaEvaluacion
          ? new Date(data.fechaEvaluacion).toISOString()
          : new Date().toISOString(),

        tipo_practica: data.tipoPractica,
        secI: data.secI,
        secII: data.secII,
        secIII: data.secIII,
        sugerencias: data.sugerencias,
        cumplePerfilEgreso: data.cumplePerfilEgreso,
        comentariosAdicionales: data.comentariosAdicionales ?? null,

        
      };
    }

    this.encuestasApi.createEncuesta(payload).subscribe({
      next: () => {
        this.mostrarOk('Encuesta registrada exitosamente.');
        this.loadEncuestas();
        this.cerrarRegistro();
        this.computeEstadisticasEstudiantiles();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al crear encuesta', err);
        const msg =
          err?.error?.message ??
          `Error ${err.status} al guardar la encuesta.`;
        this.mostrarError(msg);
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  

  // ---------- EXPORT ----------
  // Descarga Excel con todas las encuestas
  downloadExcel() {
    this.isLoading = true;
    this.encuestasApi.exportEncuestasExcel().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'encuestas_estudiantes.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error al descargar Excel', err);
        this.mostrarError('Error al descargar Excel');
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  // ---------- SNACKBARS ----------
  // Mensaje informativo de éxito
  private mostrarOk(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', {
      duration: 3000,
      panelClass: ['snackbar-success'],
    });
  }

  // Mensaje de error
  private mostrarError(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', {
      duration: 5000,
      panelClass: ['snackbar-error'],
    });
  }
}
