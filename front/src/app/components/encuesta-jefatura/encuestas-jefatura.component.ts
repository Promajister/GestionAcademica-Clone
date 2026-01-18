import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import {
  EncuestaJefaturaService,
  EncuestaJefaturaPayload,
  SubtipoEncuestaBidireccional
} from '../../services/encuesta-jefatura.service';
import {
  ActividadVinculacionService,
  ActividadOption as ActividadVinculacionOption,
} from '../../services/actividades-pm.service';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

type ScaleType = 'INTERES' | 'ACUERDO' | 'PREPARACION';


interface SurveyQuestion {
  key: string;
  text: string;
  required?: boolean;
}

interface SurveySection {
  id: string;
  title: string;
  scale: ScaleType;
  questions: SurveyQuestion[];
}

interface SurveyConfig {
  subtipo: SubtipoEncuestaBidireccional;
  title: string;
  objetivo: string;
  identificacion: Array<
    | { key: string; label: string; type: 'text'; required?: boolean }
    | { key: string; label: string; type: 'yesno'; required?: boolean }
    | { key: string; label: string; type: 'activity-select'; required?: boolean }
    | { key: string; label: string; type: 'select'; required?: boolean }   
  >;

  sections: SurveySection[];

  abiertas: Array<{ key: string; label: string; required?: boolean }>;
}

@Component({
  selector: 'app-encuesta-jefatura',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatButtonModule,
    MatDividerModule,
    MatSnackBarModule,
    MatSelectModule,
    MatCardModule,
    MatIconModule,
  ],
  templateUrl: './encuestas-jefatura.component.html',
  styleUrls: ['./encuestas-jefatura.component.scss'],
})
export class EncuestaJefaturaComponent implements OnInit {
  isSaving = false;
  escala = [1, 2, 3, 4, 5];
  registroVisible = false;
  registroGrupo: 'AULAS' | 'ALTERNANCIAS' | null = null;
  encuestas: any[] = [];
  isLoadingEncuestas = false;
  selectedEncuesta: any | null = null;
  encuestaEnEdicion: any | null = null;

  actividades: ActividadVinculacionOption[] = [];
  isLoadingActividades = false;

  filtroSubtipo: SubtipoEncuestaBidireccional | 'ALL' = 'ALL';
  filtroActividadId: number | 'ALL' = 'ALL';
  filtroNivel = '';     
  filtroBusqueda = '';

  readonly NIVELES_ESCOLARES = [
    '5to básico',
    '6to básico',
    '7mo básico',
    '8vo básico',
    '1ro medio',
    '2do medio',
    '3ro medio',
    '4to medio',
  ];

  readonly NIVELES_PREGRADO = [
    '1er año',
    '2do año',
    '3er año',
    '4to año',
    '5to año',
  ];

  get nivelesRegistro(): string[] {
    return this.selectedSubtipo === 'ALTERNANCIAS_PREGRADO'
      ? this.NIVELES_PREGRADO
      : this.NIVELES_ESCOLARES;
  }

  private normalize(v: any): string {
    return (v ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private getIdent(encuesta: any): any {
    return encuesta?.identificacion || {};
  }

  private getActividadId(encuesta: any): number | null {
    const ident = this.getIdent(encuesta);
    const id = ident.actividadVinculacionId;
    if (id === undefined || id === null || id === '') return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }

  private getNivel(encuesta: any): string {
    const ident = this.getIdent(encuesta);
    return String(ident.nivelEducacional ?? ident.nivel ?? '');
  }

  private getNombreOEscuela(encuesta: any): string {
    const ident = this.getIdent(encuesta);
    // Alternancias pregrado: nombre
    if (encuesta?.subtipo === 'ALTERNANCIAS_PREGRADO') {
      return String(ident.nombre ?? '');
    }
    // Otros: escuela/liceo
    return String(ident.escuelaOLiceo ?? '');
  }

  private getActividadNombreById(id: number | null): string {
    if (!id) return '';
    const a = this.actividades.find(x => x.id === id);
    return a?.nombre ?? '';
  }

  get encuestasFiltradas(): any[] {
    const q = this.normalize(this.filtroBusqueda);
    const nivelQ = this.normalize(this.filtroNivel);

    return (this.encuestas || []).filter((e) => {
      // 1) filtro subtipo
      if (this.filtroSubtipo !== 'ALL' && e.subtipo !== this.filtroSubtipo) return false;

      // 2) filtro actividad
      const actId = this.getActividadId(e);
      if (this.filtroActividadId !== 'ALL' && actId !== this.filtroActividadId) return false;

      // 3) filtro nivel (nivelEducacional o nivel)
      if (this.filtroNivel) {
        const nivel = this.normalize(this.getNivel(e));
        if (this.normalize(this.filtroNivel) !== nivel) return false;
      }
      // 4) búsqueda libre (nombre/escuela + actividad)
      if (q) {
        const nombreEscuela = this.normalize(this.getNombreOEscuela(e));
        const actividadNombre = this.normalize(this.getActividadNombreById(actId));
        const actividadLabel = this.normalize(this.getActividadLabel(e)); // ya lo tienes

        const hayMatch =
          nombreEscuela.includes(q) ||
          actividadNombre.includes(q) ||
          actividadLabel.includes(q);

        if (!hayMatch) return false;
      }

      return true;
    });
  }

  limpiarFiltros(): void {
    this.filtroSubtipo = 'ALL';
    this.filtroActividadId = 'ALL';
    this.filtroNivel = '';
    this.filtroBusqueda = '';
  }

  readonly SURVEYS: SurveyConfig[] = [
    {
      subtipo: 'AULA_ABIERTA_RECORRIDO_PEDAGOGICO',
      title: 'Aula Abierta y Recorrido Pedagógico — Comunidades escolares',
      objetivo: 'Recoger la percepción de los y las estudiantes escolares sobre su participación en actividades de aula abierta y recorrido pedagógico, con el fin de evaluar el impacto de estas instancias en el acercamiento al contexto universitario, el interés por la carrera pedagógica y la valoración de los contenidos abordados.',
      identificacion: [
        { key: 'actividadVinculacionId', label: 'Actividad asociada', type: 'activity-select', required: true },
        { key: 'escuelaOLiceo', label: 'Escuela o liceo', type: 'text', required: true },
        { key: 'nivelEducacional', label: 'Nivel educacional', type: 'select', required: true },
        { key: 'haVisitadoAntes', label: '¿Has visitado antes la universidad?', type: 'yesno', required: true },
      ],
      sections: [
        {
          id: 'expectativa',
          title: 'Sección 1: Expectativa',
          scale: 'INTERES',
          questions: [
            { key: 'p1', text: '¿Qué tan motivado/a estabas por participar en esta visita?', required: true },
            { key: 'p2', text: '¿Tenías interés previo en la carrera de Pedagogía en Historia y Geografía?', required: true },
            { key: 'p3', text: '¿Creías que la actividad aportaría a tu aprendizaje?', required: true },
          ],
        },
        {
          id: 'experiencia',
          title: 'Sección 2: Experiencia universitaria',
          scale: 'ACUERDO',
          questions: [
            { key: 'p1', text: '¿Siente que se fomentó la participación activa de todos los estudiantes?', required: true },
            { key: 'p2', text: '¿Los contenidos trabajados se relacionan con lo que he aprendido en el colegio?', required: true },
            { key: 'p3', text: '¿Las actividades fueron interesantes y bien organizadas?', required: true },
            { key: 'p4', text: '¿Esta visita me permitió conocer más de la carrera y conocer espacios universitarios que no conocía?', required: true },
            { key: 'p5', text: 'Satisfacción global con la actividad', required: true },
          ],
        },
      ],
      abiertas: [
        { key: 'a', label: '¿Qué fue lo que más te gustó de la visita?' },
        { key: 'b', label: '¿Crees que esta actividad influyó en tu interés por seguir estudios superiores?' },
        { key: 'c', label: '¿Qué mejorarías?' },
      ],
    },

    {
      subtipo: 'ALTERNANCIAS_PREGRADO',
      title: 'Alternancias Pedagógicas — Estudiantes de pregrado',
      objetivo: 'Evaluar el impacto de las actividades de alternancia pedagógica en la formación profesional de los estudiantes de pregrado, identificando el grado de apropiación de contenidos, desarrollo de habilidades pedagógicas y experiencia en contextos escolares reales.',
      identificacion: [
        { key: 'actividadVinculacionId', label: 'Actividad asociada', type: 'activity-select', required: true },
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        { key: 'nivel', label: 'Nivel', type: 'select', required: true },
        { key: 'haParticipadoAntes', label: '¿Has participado antes en alternancias?', type: 'yesno', required: true },
      ],
      sections: [
        {
          id: 'preparacion',
          title: 'Sección 1: Preparación',
          scale: 'PREPARACION',
          questions: [
            { key: 'p1', text: '¿Presenta conocimientos básicos sobre el tema a abordar en la actividad?', required: true },
            { key: 'p2', text: '¿Considera que la orientación docente previa fue suficiente?', required: true },
            { key: 'p3', text: '¿Los contenidos fueron claros y acordes al nivel del grupo escolar?', required: true },
            { key: 'p4', text: '¿Le parece interesante participar en actividades de aula para estudiantes de recintos educacionales?', required: true },
            { key: 'p5', text: '¿Qué tan preparado/a te sientes para dirigir una actividad en aula?', required: true },
          ],
        },
        {
          id: 'desarrollo',
          title: 'Sección 2: Desarrollo y aprendizaje',
          scale: 'ACUERDO',
          questions: [
            { key: 'p1', text: '¿Cree usted que esta actividad contribuyo a su formación profesional?', required: true },
            { key: 'p2', text: '¿Desarrollé habilidades como liderazgo y comunicación?', required: true },
            { key: 'p3', text: '¿Logré aplicar conocimientos teóricos en la práctica real?', required: true },
            { key: 'p4', text: '¿Me sentí capaz de gestionar una actividad con estudiantes escolares?', required: true },
            { key: 'p5', text: '¿Volvería a participar?', required: true },
            { key: 'p6', text: '¿Recomendaría esta experiencia a otros compañeros?', required: true },
            { key: 'p7', text: 'Satisfacción global con la actividad', required: true },
          ],
        },
      ],
      abiertas: [
        { key: 'a', label: '¿Qué mejorarías para futuras alternancias?' },
      ],
    },

    {
      subtipo: 'ALTERNANCIAS_RECEPTORES',
      title: 'Alternancias Pedagógicas — Estudiantes Receptores',
      objetivo: 'Conocer la experiencia y percepción de los estudiantes escolares que participaron en actividades dirigidas por estudiantes universitarios, con el propósito de evaluar el impacto en su aprendizaje, motivación y vínculo con la educación superior.',
      identificacion: [
        { key: 'actividadVinculacionId', label: 'Actividad asociada', type: 'activity-select', required: true },
        { key: 'escuelaOLiceo', label: 'Escuela o liceo', type: 'text', required: true },
        { key: 'nivelEducacional', label: 'Nivel educacional', type: 'select', required: true },
        { key: 'haParticipadoAntes', label: '¿Has participado antes en una actividad con estudiantes universitarios?', type: 'yesno', required: true },
      ],
      sections: [
        {
          id: 'expectativas',
          title: 'Sección 1: Expectativas iniciales',
          scale: 'INTERES',
          questions: [
            { key: 'p1', text: '¿Se encuentra interesado y motivado por la visita de los universitarios?', required: true },
            { key: 'p2', text: '¿Le parece interesante que se realice una clase dirigida por estudiantes universitarios?', required: true },
            { key: 'p3', text: '¿Cree que esta actividad puede aportar a su aprendizaje habitual?', required: true },
          ],
        },
        {
          id: 'clase',
          title: 'Sección 2: Desarrollo de la clase',
          scale: 'ACUERDO',
          questions: [
            { key: 'p1', text: '¿Comprendió los conceptos y contenidos trabajados en clases?', required: true },
            { key: 'p2', text: '¿Pude conectar lo aprendido con temas que ya conocía?', required: true },
            { key: 'p3', text: '¿Le gusto la experiencia de alternancia pedagógica?', required: true },
            { key: 'p4', text: '¿La dinámica fue diferente a otras clases habituales?', required: true },
            { key: 'p5', text: '¿Me sentí cómodo/a participando en la clase dirigida por los estudiantes?', required: true },
            { key: 'p6', text: 'Satisfacción global con la actividad', required: true },
          ],
        },
      ],
      abiertas: [
        { key: 'a', label: '¿Qué fue lo que más te gustó de la clase?' },
        { key: 'b', label: '¿Crees que este tipo de clases mejora tu comprensión de los contenidos escolares?' },
        { key: 'c', label: '¿Te gustaría participar en otras actividades similares con estudiantes universitarios?' },
        { key: 'd', label: '¿Qué sugerirías para mejorar la experiencia?' },
      ],
    },
  ];

  selectedSubtipo: SubtipoEncuestaBidireccional = this.SURVEYS[0].subtipo;

  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private api: EncuestaJefaturaService,
    private actividadService: ActividadVinculacionService,
    private snack: MatSnackBar
  ) {
    this.buildForm(this.selectedSubtipo);
    this.loadActividades();
  }

  ngOnInit(): void {
    this.loadEncuestas();
  }

  private loadEncuestas(): void {
    this.isLoadingEncuestas = true;
    this.api.getAll().subscribe({
      next: (data) => {
        this.encuestas = (data || []).map((e) => ({
          ...e,
          fecha: e.fecha ? new Date(e.fecha) : null,
        }));
        this.isLoadingEncuestas = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoadingEncuestas = false;
      },
    });
  }

  private loadActividades(): void {
    this.isLoadingActividades = true;
    this.actividadService.listarParaSelect().subscribe({
      next: (data) => {
        this.actividades = data || [];
        this.isLoadingActividades = false;
      },
      error: (err) => {
        console.error(err);
        this.actividades = [];
        this.isLoadingActividades = false;
      },
    });
  }

  get currentSurvey(): SurveyConfig {
    return this.SURVEYS.find(s => s.subtipo === this.selectedSubtipo)!;
  }

  onChangeSurvey(subtipo: SubtipoEncuestaBidireccional) {
    this.selectedSubtipo = subtipo;
    this.buildForm(subtipo);
  }

  openRegistroAulas(): void {
    this.registroGrupo = 'AULAS';
    this.selectedSubtipo = 'AULA_ABIERTA_RECORRIDO_PEDAGOGICO';
    this.buildForm(this.selectedSubtipo);
    this.registroVisible = true;
  }

  openRegistroAlternancias(): void {
    this.registroGrupo = 'ALTERNANCIAS';
    if (
      this.selectedSubtipo !== 'ALTERNANCIAS_PREGRADO' &&
      this.selectedSubtipo !== 'ALTERNANCIAS_RECEPTORES'
    ) {
      this.selectedSubtipo = 'ALTERNANCIAS_PREGRADO';
    }
    this.buildForm(this.selectedSubtipo);
    this.registroVisible = true;
  }

  cerrarRegistro(): void {
    this.registroVisible = false;
  }

  verDetalles(encuesta: any): void {
    this.selectedEncuesta = encuesta;
  }

  cerrarDetalles(): void {
    this.selectedEncuesta = null;
  }

  editarEncuesta(encuesta: any): void {
    this.encuestaEnEdicion = JSON.parse(JSON.stringify(encuesta));
  }

  cancelarEdicion(): void {
    this.encuestaEnEdicion = null;
  }

  mapSubtipoLabel(subtipo: SubtipoEncuestaBidireccional): string {
    switch (subtipo) {
      case 'AULA_ABIERTA_RECORRIDO_PEDAGOGICO':
        return 'Aulas Abiertas y Recorridos Pedagogicos';
      case 'ALTERNANCIAS_PREGRADO':
        return 'Alternancias Pedagogicas - Pregrado';
      case 'ALTERNANCIAS_RECEPTORES':
        return 'Alternancias Pedagogicas - Estudiantes Receptores';
      default:
        return 'Encuesta';
    }
  }

  getIdentificacionLinea1(encuesta: any): string {
    const ident = encuesta?.identificacion || {};
    if (encuesta?.subtipo === 'ALTERNANCIAS_PREGRADO') {
      return `Nombre: ${ident.nombre ?? 'Sin dato'}`;
    }
    return `Escuela/Liceo: ${ident.escuelaOLiceo ?? 'Sin dato'}`;
  }

  getIdentificacionLinea2(encuesta: any): string {
    const ident = encuesta?.identificacion || {};
    const nivel = ident.nivelEducacional || ident.nivel || 'Sin dato';
    return `Nivel: ${nivel}`;
  }

  getActividadLabel(encuesta: any): string {
    const ident = encuesta?.identificacion || {};
    const actividadId = ident.actividadVinculacionId;
    if (!actividadId) return 'Actividad: Sin dato';
    const actividad = this.actividades.find((a) => a.id === Number(actividadId));
    return `Actividad: ${actividad ? actividad.nombre : actividadId}`;
  }

  getIdentificacionRows(encuesta: any): Array<{ key: string; value: string }> {
    const ident = encuesta?.identificacion || {};
    const rows: Array<{ key: string; value: string }> = [];
    const push = (key: string, value: any) => {
      if (value !== undefined && value !== null && value !== '') {
        rows.push({ key, value: this.formatIdentificacionValue(value) });
      }
    };

    push('Actividad', this.getActividadLabel(encuesta).replace('Actividad: ', ''));
    for (const [k, v] of Object.entries(ident)) {
      if (k === 'actividadVinculacionId') continue;
      rows.push({ key: this.mapIdentificacionLabel(k), value: this.formatIdentificacionValue(v) });
    }
    return rows;
  }

  mapIdentificacionLabel(key: string): string {
    const labels: Record<string, string> = {
      actividadVinculacionId: 'Actividad',
      escuelaOLiceo: 'Escuela o liceo',
      nivelEducacional: 'Nivel educacional',
      haVisitadoAntes: 'Ha visitado antes la universidad',
      nombre: 'Nombre',
      nivel: 'Nivel',
      haParticipadoAntes: 'Ha participado antes en alternancias',
    };
    return labels[key] || key;
  }

  private formatIdentificacionValue(value: any): string {
    if (typeof value === 'boolean') {
      return value ? 'Si' : 'No';
    }
    return String(value);
  }

  mapRespuestaValor(respuesta: any): string {
    return respuesta?.alternativa?.descripcion ?? respuesta?.respuestaAbierta ?? '';
  }

  isNumericRespuesta(respuesta: any): boolean {
    const val = this.mapRespuestaValor(respuesta);
    return /^(\d+)$/.test(val);
  }

  getRespuestasCerradas(respuestas: any[] | null | undefined): any[] {
    return (respuestas || []).filter((r) => this.isNumericRespuesta(r));
  }

  getRespuestasAbiertas(respuestas: any[] | null | undefined): any[] {
    return (respuestas || []).filter((r) => !this.isNumericRespuesta(r));
  }

  get respuestasAbiertasEditables(): any[] {
    if (!this.encuestaEnEdicion?.respuestas) return [];
    return this.encuestaEnEdicion.respuestas.filter(
      (r: any) => r?.respuestaAbierta !== undefined && r?.respuestaAbierta !== null
    );
  }

  guardarEdicionAbiertas(): void {
    if (!this.encuestaEnEdicion) return;
    const payload = {
      respuestas: this.respuestasAbiertasEditables.map((r: any) => ({
        preguntaId: r.preguntaId,
        respuestaAbierta: r.respuestaAbierta ?? '',
      })),
    };

    this.api.actualizarAbiertas(this.encuestaEnEdicion.id, payload).subscribe({
      next: () => {
        this.snack.open('Respuestas abiertas actualizadas.', 'OK', { duration: 3000 });
        this.encuestaEnEdicion = null;
        this.loadEncuestas();
      },
      error: (err) => {
        console.error(err);
        this.snack.open('Error al actualizar respuestas abiertas.', 'Cerrar', { duration: 4000 });
      },
    });
  }

  mapPreguntaDescripcion(clave: string | null | undefined): string {
    if (!clave) return '';
    for (const survey of this.SURVEYS) {
      for (const sec of survey.sections) {
        for (const q of sec.questions) {
          if (`${sec.id}.${q.key}` === clave) {
            return q.text;
          }
        }
      }

      for (const abierta of survey.abiertas) {
        if (`abiertas.${abierta.key}` === clave) {
          return abierta.label;
        }
      }
    }

    return clave;
  }

  get groupAulasAbiertas(): SurveyConfig[] {
    return this.SURVEYS.filter(s =>
        s.subtipo === 'AULA_ABIERTA_RECORRIDO_PEDAGOGICO'
    );
  }

  get groupAlternancias(): SurveyConfig[] {
    return this.SURVEYS.filter(s =>
        s.subtipo === 'ALTERNANCIAS_PREGRADO' || s.subtipo === 'ALTERNANCIAS_RECEPTORES'
    );
  }

  get correoContexto(): { titulo: string; descripcion: string } {
    const subtipo = this.selectedSubtipo;

    const isAulaAbierta =
        subtipo === 'AULA_ABIERTA_RECORRIDO_PEDAGOGICO';

    if (isAulaAbierta) {
        return {
        titulo: 'Aulas Abiertas y Recorridos Pedagógicos',
        descripcion:
            'Encuesta correspondiente a actividades realizadas en conjunto con los programas PACE y PROPED, orientadas a comunidades escolares.'
        };
    }

    return {
        titulo: 'Alternancias Pedagógicas',
        descripcion:
        'Encuesta asociada a las alternancias pedagógicas realizadas por estudiantes de pregrado en comunidades escolares.'
    };
  }

  
  buildForm(subtipo: SubtipoEncuestaBidireccional) {
    const cfg = this.SURVEYS.find(s => s.subtipo === subtipo)!;

    const identificacionGroup: Record<string, FormControl> = {};
    for (const f of cfg.identificacion) {
      identificacionGroup[f.key] = new FormControl(
        null,
        f.required ? [Validators.required] : []
      );
    }

    const seccionesGroup: Record<string, FormGroup> = {};
    for (const sec of cfg.sections) {
      const qCtrls: Record<string, FormControl> = {};
      for (const q of sec.questions) {
        qCtrls[q.key] = new FormControl(
          null,
          q.required ? [Validators.required, Validators.min(1), Validators.max(5)] : []
        );
      }
      seccionesGroup[sec.id] = this.fb.group(qCtrls);
    }

    const abiertasGroup: Record<string, FormControl> = {};
    for (const a of cfg.abiertas) {
      abiertasGroup[a.key] = new FormControl('', a.required ? [Validators.required] : []);
    }

    this.form = this.fb.group({
      identificacion: this.fb.group(identificacionGroup),
      secciones: this.fb.group(seccionesGroup),
      abiertas: this.fb.group(abiertasGroup),
    });
  }

  private computeSemestre(d = new Date()): 1 | 2 {
    const month = d.getMonth();
    return month <= 5 ? 1 : 2;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.open('Completa los campos obligatorios.', 'Cerrar', { duration: 3000 });
      return;
    }

    const now = new Date();

    const payload: EncuestaJefaturaPayload = {
      tipo: 'JEFATURA_CARRERA',
      anioEncuesta: now.getFullYear(),
      semestreEncuesta: this.computeSemestre(now),
      data: {
        subtipo: this.selectedSubtipo,
        identificacion: this.form.get('identificacion')?.value,
        secciones: this.form.get('secciones')?.value,
        abiertas: this.form.get('abiertas')?.value,
      },
    };

    this.isSaving = true;
    this.api.crear(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.snack.open('Encuesta enviada correctamente.', 'OK', { duration: 3000 });
        this.buildForm(this.selectedSubtipo); 
        this.cerrarRegistro();
        this.loadEncuestas();
      },
      error: (err) => {
        this.isSaving = false;
        this.snack.open('Error al enviar la encuesta.', 'Cerrar', { duration: 4000 });
        console.error(err);
      },
    });
  }

  scaleLabel(type: ScaleType): string {
    switch (type) {
      case 'INTERES': return 'Escala 1-5 (1 totalmente desinteresado / 5 totalmente interesado)';
      case 'PREPARACION': return 'Escala 1-5 (1 nada preparado/a / 5 muy preparado/a)';
      case 'ACUERDO': return 'Escala 1-5 (1 totalmente en desacuerdo / 5 totalmente de acuerdo)';
    }
  }

  private toNumberOrNull(val: any): number | null {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  private clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  /** Retorna [0..4] desde la respuesta cerrada (1..5); null si no aplica */
  private getClosedAnswerScore0to4(respuesta: any): number | null {
    const raw = this.mapRespuestaValor(respuesta);
    const n = this.toNumberOrNull(raw);
    if (n === null) return null;

    // Validamos que venga en 1..5
    if (n < 1 || n > 5) return null;

    // Reescalamos: 1->0, 2->1, 3->2, 4->3, 5->4
    return n - 1;
  }

  /** Promedio reescalado (0..4) */
  getPromedioEncuesta(encuesta: any): number | null {
    const cerradas = this.getRespuestasCerradas(encuesta?.respuestas);
    const values = cerradas
      .map(r => this.getClosedAnswerScore0to4(r))
      .filter((v): v is number => v !== null);

    if (!values.length) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length; // 0..4
  }

  /** % satisfacción basado en promedio/4 (porque ahora el máximo es 4) */
  getSatisfaccionEncuestaPct(encuesta: any): number | null {
    const avg0to4 = this.getPromedioEncuesta(encuesta);
    if (avg0to4 === null) return null;

    return this.clamp((avg0to4 / 4) * 100, 0, 100);
  }

  get nivelesFiltro(): string[] {
    if (this.filtroSubtipo === 'ALL') {
      // Si no eligieron tipo, mostramos todos
      return [...this.NIVELES_ESCOLARES, ...this.NIVELES_PREGRADO];
    }
    return this.filtroSubtipo === 'ALTERNANCIAS_PREGRADO'
      ? this.NIVELES_PREGRADO
      : this.NIVELES_ESCOLARES;
  }

}

