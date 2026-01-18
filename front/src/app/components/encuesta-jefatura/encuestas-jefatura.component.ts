import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  EncuestaJefaturaService,
  EncuestaJefaturaPayload,
  SubtipoEncuestaBidireccional
} from '../../services/encuesta-jefatura.service';

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

interface ActividadOption {
  id: number;
  nombre: string;
  fechaInicio?: string; 
}

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
  >;

  sections: SurveySection[];

  abiertas: Array<{ key: string; label: string; required?: boolean }>;
}

@Component({
  selector: 'app-encuesta-jefatura',
  standalone: true,
  imports: [
    CommonModule,
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
export class EncuestaJefaturaComponent {
  isSaving = false;
  escala = [1, 2, 3, 4, 5];

  actividades: ActividadOption[] = [];
  isLoadingActividades = false;

  readonly SURVEYS: SurveyConfig[] = [
    {
      subtipo: 'AULA_ABIERTA_RECORRIDO_PEDAGOGICO',
      title: 'Aula Abierta y Recorrido Pedagógico — Comunidades escolares',
      objetivo: 'Recoger la percepción de los y las estudiantes escolares sobre su participación en actividades de aula abierta y recorrido pedagógico, con el fin de evaluar el impacto de estas instancias en el acercamiento al contexto universitario, el interés por la carrera pedagógica y la valoración de los contenidos abordados.',
      identificacion: [
        { key: 'actividadVinculacionId', label: 'Actividad asociada', type: 'activity-select', required: true },
        { key: 'escuelaOLiceo', label: 'Escuela o liceo', type: 'text', required: true },
        { key: 'nivelEducacional', label: 'Nivel educacional', type: 'text', required: true },
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
        { key: 'nivel', label: 'Nivel', type: 'text', required: true },
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
        { key: 'nivelEducacional', label: 'Nivel educacional', type: 'text', required: true },
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
    private snack: MatSnackBar
  ) {
    this.buildForm(this.selectedSubtipo);
    this.loadActividades();
  }

  private loadActividades(): void {
    this.isLoadingActividades = true;

    setTimeout(() => {
      this.actividades = [
        { id: 1, nombre: 'Alternancia Pedagógica - Liceo San José' },
        { id: 2, nombre: 'Aula Abierta - Colegio Andino' },
        { id: 3, nombre: 'Salida a Terreno - Parque Nacional' },
      ];
      this.isLoadingActividades = false;
    }, 600);
  }

  get currentSurvey(): SurveyConfig {
    return this.SURVEYS.find(s => s.subtipo === this.selectedSubtipo)!;
  }

  onChangeSurvey(subtipo: SubtipoEncuestaBidireccional) {
    this.selectedSubtipo = subtipo;
    this.buildForm(subtipo);
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
}
