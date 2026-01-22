import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { EncuestasEgresadosService } from '../../services/encuestas-egresados.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type SurveyTipo = 'EMPLEABILIDAD' | 'ACREDITACION';

interface EgresadoEncuestaRow {
  id: number;
  tipo: SurveyTipo;
  fecha?: string | Date | null;
  generales?: Record<string, any> | null;
  respuestas?: Array<{
    pregunta?: { descripcion?: string | null };
    alternativa?: { descripcion?: string | null };
    respuestaAbierta?: string | null;
  }>;  
}

interface PieSegment {
  label: string;
  count: number;
  pct: number;
  color: string;
}

interface PieStat {
  total: number;
  segments: PieSegment[];
}

interface EmpleabilidadStats {
  total: number;
  estadoLaboral: PieStat;
  tiempoEmpleo: PieStat;
  empleoGenero: PieStat;
  sector: PieStat;
  cargo: PieStat;
  renta: PieStat;
  tipoInstitucion: PieStat;
  pertinencia: PieStat;
  postgrado: PieStat;
  capacitacion: PieStat;
}

interface AcreditacionStats {
  total: number;
  promedioLikert: number;
  totalLikertRespuestas: number;
  pctPerfilEgreso: number;
  countPerfilEgreso: number;
  pctRecursos: number;
  countRecursos: number;
  pctMejora: number;
  countMejora: number;
  pctAutoevaluacion: number;
  countAutoevaluacion: number;
  pctComentarios: number;
  countComentarios: number;
  preguntas: Array<{
    key: string;
    label: string;
    stat: PieStat;
  }>;
}

@Component({
  standalone: true,
  selector: 'app-egresados-analisis',
  imports: [
    CommonModule,
    HttpClientModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatMenuModule,
  ],
  templateUrl: './egresados-analisis.component.html',
  styleUrls: ['./egresados-analisis.component.scss'],
})
export class EgresadosAnalisisComponent implements OnInit {
  private api = inject(EncuestasEgresadosService);

  isLoading = false;
  generatingEmpleabilidad = false;
  generatingAcreditacion = false;
  showEmpleabilidadConclusion = false;
  showAcreditacionConclusion = false;
  conclusionEmpleabilidadText = '';
  conclusionAcreditacionText = '';
  encuestas: EgresadoEncuestaRow[] = [];
  aniosEgreso: number[] = [];
  anioEgresoFiltroEmpleabilidad: number | 'ALL' = 'ALL';
  anioEgresoFiltroAcreditacion: number | 'ALL' = 'ALL';

  empleabilidad: EmpleabilidadStats = {
    total: 0,
    estadoLaboral: { total: 0, segments: [] },
    tiempoEmpleo: { total: 0, segments: [] },
    empleoGenero: { total: 0, segments: [] },
    sector: { total: 0, segments: [] },
    cargo: { total: 0, segments: [] },
    renta: { total: 0, segments: [] },
    tipoInstitucion: { total: 0, segments: [] },
    pertinencia: { total: 0, segments: [] },
    postgrado: { total: 0, segments: [] },
    capacitacion: { total: 0, segments: [] },
  };

  acreditacion: AcreditacionStats = {
    total: 0,
    promedioLikert: 0,
    totalLikertRespuestas: 0,
    pctPerfilEgreso: 0,
    countPerfilEgreso: 0,
    pctRecursos: 0,
    countRecursos: 0,
    pctMejora: 0,
    countMejora: 0,
    pctAutoevaluacion: 0,
    countAutoevaluacion: 0,
    pctComentarios: 0,
    countComentarios: 0,
    preguntas: [],
  };

  private readonly likertMap: Record<string, number> = {
    'Muy en desacuerdo': 1,
    'En desacuerdo': 2,
    'Ni de acuerdo ni en desacuerdo': 3,
    'De acuerdo': 4,
    'Muy de acuerdo': 5,
  };
  private readonly likertLabels = [
    'Muy en desacuerdo',
    'En desacuerdo',
    'Ni de acuerdo ni en desacuerdo',
    'De acuerdo',
    'Muy de acuerdo',
  ];
  private readonly acreditacionPreguntas = [
    { key: 'secciones.perfilEgreso.p1', label: 'Conoci el perfil de egreso de la carrera.' },
    { key: 'secciones.perfilEgreso.p2', label: 'La formacion recibida corresponde al perfil de egreso declarado.' },
    { key: 'secciones.planEstudios.p3', label: 'El plan de estudios fue consistente con el perfil de egreso.' },
    { key: 'secciones.planEstudios.p4', label: 'Las asignaturas ofrecidas ayudaron al logro del perfil de egreso.' },
    { key: 'secciones.planEstudios.p5', label: 'Las evaluaciones eran pertinentes y coherentes con los objetivos de aprendizaje.' },
    { key: 'secciones.planEstudios.p6', label: 'Participe en actividades sobre etica, inclusion, diversidad y responsabilidad social.' },
    { key: 'secciones.formacionPractica.p7', label: 'Las practicas profesionales se realizaron con instituciones pertinentes.' },
    { key: 'secciones.formacionPractica.p8', label: 'Existio acompanamiento y supervision formal en la formacion practica.' },
    { key: 'secciones.formacionPractica.p9', label: 'Las actividades de practica fueron evaluadas con pautas claras.' },
    { key: 'secciones.cuerpoAcademico.p10', label: 'Los profesores tenian conocimientos actualizados y metodologias adecuadas.' },
    { key: 'secciones.cuerpoAcademico.p11', label: 'Existia un equipo docente que lideraba el proyecto formativo.' },
    { key: 'secciones.cuerpoAcademico.p12', label: 'Recibi material y herramientas elaboradas por mis docentes.' },
    { key: 'secciones.gestionRecursos.p13', label: 'La infraestructura y equipamiento eran adecuados para el aprendizaje.' },
    { key: 'secciones.gestionRecursos.p14', label: 'La biblioteca y recursos digitales eran suficientes.' },
    { key: 'secciones.gestionRecursos.p15', label: 'Existian mecanismos formalizados para atender solicitudes de estudiantes.' },
    { key: 'secciones.gestionRecursos.p16', label: 'La gestion del cuerpo directivo permitia una conduccion eficaz.' },
    { key: 'secciones.autorregulacion.p17', label: 'Participe en procesos de autoevaluacion de la carrera.' },
    { key: 'secciones.autorregulacion.p18', label: 'Observe mejoras durante mi formacion por aseguramiento de calidad.' },
    { key: 'secciones.autorregulacion.p19', label: 'La carrera apoya insercion profesional y seguimiento de titulados.' },
  ];

  ngOnInit(): void {
    this.loadEncuestas();
  }

  private loadEncuestas(): void {
    this.isLoading = true;
    this.api.getAll().subscribe({
      next: (data) => {
        this.encuestas = (data || []) as EgresadoEncuestaRow[];
        this.isLoading = false;
        this.buildStats();
      },
      error: () => {
        this.encuestas = [];
        this.isLoading = false;
        this.buildStats();
      },
    });
  }

  private buildStats(): void {
    const empleabilidad = this.encuestas.filter((e) => e.tipo === 'EMPLEABILIDAD');
    this.aniosEgreso = this.buildAniosEgreso(this.encuestas);
    if (
      this.anioEgresoFiltroEmpleabilidad !== 'ALL'
      && !this.aniosEgreso.includes(this.anioEgresoFiltroEmpleabilidad)
    ) {
      this.anioEgresoFiltroEmpleabilidad = 'ALL';
    }
    if (
      this.anioEgresoFiltroAcreditacion !== 'ALL'
      && !this.aniosEgreso.includes(this.anioEgresoFiltroAcreditacion)
    ) {
      this.anioEgresoFiltroAcreditacion = 'ALL';
    }
    const empleabilidadFiltrada = this.filterEmpleabilidadByYear(empleabilidad);
    const acreditacion = this.encuestas.filter((e) => e.tipo === 'ACREDITACION');
    const acreditacionFiltrada = this.filterAcreditacionByYear(acreditacion);

    this.empleabilidad = this.buildEmpleabilidadStats(empleabilidadFiltrada);
    this.acreditacion = this.buildAcreditacionStats(acreditacionFiltrada);

    this.cargarConclusionesGuardadas();
  }

  onAnioEgresoEmpleabilidadChange(value: number | 'ALL'): void {
    this.anioEgresoFiltroEmpleabilidad = value;
    this.buildStats();
  }

  onAnioEgresoAcreditacionChange(value: number | 'ALL'): void {
    this.anioEgresoFiltroAcreditacion = value;
    this.buildStats();
  }

  private buildAniosEgreso(encuestas: EgresadoEncuestaRow[]): number[] {
    const years = new Set<number>();
    for (const encuesta of encuestas) {
      const year = this.getAnioEgreso(encuesta);
      if (year) years.add(year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }

  private filterEmpleabilidadByYear(encuestas: EgresadoEncuestaRow[]): EgresadoEncuestaRow[] {
    if (this.anioEgresoFiltroEmpleabilidad === 'ALL') return encuestas;
    return encuestas.filter((e) => this.getAnioEgreso(e) === this.anioEgresoFiltroEmpleabilidad);
  }

  private filterAcreditacionByYear(encuestas: EgresadoEncuestaRow[]): EgresadoEncuestaRow[] {
    if (this.anioEgresoFiltroAcreditacion === 'ALL') return encuestas;
    return encuestas.filter((e) => this.getAnioEgreso(e) === this.anioEgresoFiltroAcreditacion);
  }

  private getAnioEgreso(encuesta: EgresadoEncuestaRow): number | null {
    const value = (encuesta?.generales ?? {})['anioEgreso'];
    const year = Number(value);
    return Number.isFinite(year) ? year : null;
  }

  private buildEmpleabilidadStats(encuestas: EgresadoEncuestaRow[]): EmpleabilidadStats {
    const total = encuestas.length;
    const countTrabajaSi = this.countByRespuesta(encuestas, 'insercion.trabajaActualmente', 'Si');
    const countTrabajaNo = this.countByRespuesta(encuestas, 'insercion.trabajaActualmente', 'No');

    const tiempoMenos2 = this.countByRespuesta(
      encuestas,
      'insercion.tiempoPrimerTrabajo',
      'Menos de 2 meses',
    );
    const tiempoMenos6 = this.countByRespuesta(
      encuestas,
      'insercion.tiempoPrimerTrabajo',
      'Entre 2 y 6 meses',
    );
    const tiempoMenos1 = this.countByRespuesta(
      encuestas,
      'insercion.tiempoPrimerTrabajo',
      'Entre 6 meses y 1 año',
    );

    const generoCounts = { mujer: 0, hombre: 0, noResponde: 0 };
    for (const encuesta of encuestas) {
      const sexo = String((encuesta?.generales ?? {})['sexo'] ?? '').trim();
      if (sexo === 'Mujer') generoCounts.mujer += 1;
      else if (sexo === 'Hombre') generoCounts.hombre += 1;
      else if (sexo === 'Prefiere no responder') generoCounts.noResponde += 1;
    }

    const sectorPublico = this.countByRespuesta(encuestas, 'insercion.sectorTrabajo', 'Publico');
    const sectorPrivado = this.countByRespuesta(encuestas, 'insercion.sectorTrabajo', 'Privado');
    const sectorOtro = this.countByRespuesta(encuestas, 'insercion.sectorTrabajo', 'Otro');

    const cargoJefatura = this.countByRespuesta(encuestas, 'insercion.situacionLaboral', 'Jefatura');
    const cargoEmpleado = this.countByRespuesta(encuestas, 'insercion.situacionLaboral', 'Empleado(a)');
    const cargoIndependiente = this.countByRespuesta(encuestas, 'insercion.situacionLaboral', 'Independiente');
    const cargoOtro = this.countByRespuesta(encuestas, 'insercion.situacionLaboral', 'Otro');

    const renta500 = this.countByRespuesta(
      encuestas,
      'condiciones.renta',
      'Entre $500.001 y $1.000.000',
    );
    const renta1000 = this.countByRespuesta(
      encuestas,
      'condiciones.renta',
      'Entre $1.000.001 y $1.500.000',
    );
    const renta1500 = this.countByRespuesta(
      encuestas,
      'condiciones.renta',
      'Mas de $1.500.001',
    );

    const instEstado = this.countByRespuesta(
      encuestas,
      'condiciones.tipoInstitucion',
      'Establecimiento del Estado',
    );
    const instSubv = this.countByRespuesta(
      encuestas,
      'condiciones.tipoInstitucion',
      'Particular subvencionado',
    );
    const instParticular = this.countByRespuesta(
      encuestas,
      'condiciones.tipoInstitucion',
      'Particular',
    );
    const instOtro = this.countByRespuesta(
      encuestas,
      'condiciones.tipoInstitucion',
      'Otro',
    );
    const instNoCorresponde = this.countByRespuesta(
      encuestas,
      'condiciones.tipoInstitucion',
      'No corresponde (no trabaja en educacion)',
    );

    const pertinenciaMuyDeAcuerdo = this.countByRespuesta(
      encuestas,
      'percepcion.pertinencia',
      'Muy de acuerdo',
    );
    const pertinenciaDeAcuerdo = this.countByRespuesta(
      encuestas,
      'percepcion.pertinencia',
      'De acuerdo',
    );
    const pertinenciaNeutral = this.countByRespuesta(
      encuestas,
      'percepcion.pertinencia',
      'Ni de acuerdo ni en desacuerdo',
    );
    const pertinenciaEnDesacuerdo = this.countByRespuesta(
      encuestas,
      'percepcion.pertinencia',
      'En desacuerdo',
    );
    const pertinenciaMuyEnDesacuerdo = this.countByRespuesta(
      encuestas,
      'percepcion.pertinencia',
      'Muy en desacuerdo',
    );

    const postgradoSi = this.countByRespuesta(encuestas, 'percepcion.postgrado', 'Si');
    const postgradoNo = this.countByRespuesta(encuestas, 'percepcion.postgrado', 'No');
    const capacitacionSi = this.countByRespuesta(encuestas, 'percepcion.capacitacion', 'Si');
    const capacitacionNo = this.countByRespuesta(encuestas, 'percepcion.capacitacion', 'No');

    const palette = {
      red: '#e11d48',
      blue: '#2563eb',
      green: '#15803d',
      yellow: '#f59e0b',
      orange: '#ea580c',
      purple: '#7c3aed',
      teal: '#0f766e',
    };

    return {
      total,
      estadoLaboral: this.buildPieStat([
        { label: 'Con empleo', count: countTrabajaSi, color: palette.green },
        { label: 'Sin empleo', count: countTrabajaNo, color: palette.red },
      ]),
      tiempoEmpleo: this.buildPieStat([
        { label: 'Menos de 2 meses', count: tiempoMenos2, color: palette.blue },
        { label: 'Menos de 6 meses', count: tiempoMenos6, color: palette.yellow },
        { label: 'Menos de 1 año', count: tiempoMenos1, color: palette.green },
      ]),
      empleoGenero: this.buildPieStat([
        { label: 'Mujer', count: generoCounts.mujer, color: palette.blue },
        { label: 'Hombre', count: generoCounts.hombre, color: palette.yellow },
        { label: 'No responde', count: generoCounts.noResponde, color: palette.red },
      ]),
      sector: this.buildPieStat([
        { label: 'Publico', count: sectorPublico, color: palette.blue },
        { label: 'Privado', count: sectorPrivado, color: palette.green },
        { label: 'Otro', count: sectorOtro, color: palette.yellow },
      ]),
      cargo: this.buildPieStat([
        { label: 'Jefatura', count: cargoJefatura, color: palette.yellow },
        { label: 'Empleado', count: cargoEmpleado, color: palette.blue },
        { label: 'Independiente', count: cargoIndependiente, color: palette.green },
        { label: 'Otro', count: cargoOtro, color: palette.red },
      ]),
      renta: this.buildPieStat([
        { label: '$500.001 a $1.000.000', count: renta500, color: palette.green },
        { label: '$1.000.001 a $1.500.000', count: renta1000, color: palette.blue },
        { label: 'Mas de $1.500.001', count: renta1500, color: palette.yellow },
      ]),
      tipoInstitucion: this.buildPieStat([
        { label: 'Establecimiento del Estado', count: instEstado, color: palette.blue },
        { label: 'Particular subvencionado', count: instSubv, color: palette.yellow },
        { label: 'Particular', count: instParticular, color: palette.green },
        { label: 'Otro', count: instOtro, color: palette.red },
        { label: 'No corresponde', count: instNoCorresponde, color: palette.orange },
      ]),
      pertinencia: this.buildPieStat([
        { label: 'Muy de acuerdo', count: pertinenciaMuyDeAcuerdo, color: palette.green },
        { label: 'De acuerdo', count: pertinenciaDeAcuerdo, color: palette.blue },
        { label: 'Ni de acuerdo ni en desacuerdo', count: pertinenciaNeutral, color: palette.yellow },
        { label: 'En desacuerdo', count: pertinenciaEnDesacuerdo, color: palette.orange },
        { label: 'Muy en desacuerdo', count: pertinenciaMuyEnDesacuerdo, color: palette.red },
      ]),
      postgrado: this.buildPieStat([
        { label: 'Si', count: postgradoSi, color: palette.green },
        { label: 'No', count: postgradoNo, color: palette.red },
      ]),
      capacitacion: this.buildPieStat([
        { label: 'Si', count: capacitacionSi, color: palette.blue },
        { label: 'No', count: capacitacionNo, color: palette.red },
      ]),
    };
  }

  private async loadImageAsDataURLSafe(path: string): Promise<string | null> {
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  private drawPdfHeader(
    doc: jsPDF,
    opts: {
      title: string;
      subtitle: string;
      generatedText: string;
      logoLeft?: string | null;
      logoRight?: string | null;
    }
  ) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 52;
    const headerH = 92;

    const headerFill: [number, number, number] = [248, 250, 252];
    const line: [number, number, number] = [229, 231, 235];
    const text: [number, number, number] = [17, 24, 39];
    const muted: [number, number, number] = [100, 116, 139];

    doc.setFillColor(...headerFill);
    doc.rect(0, 0, pageWidth, headerH, 'F');

    const drawLogo = (dataUrl: string | null | undefined, x: number, y: number, w: number, h: number) => {
      if (!dataUrl) return;
      doc.addImage(dataUrl, 'PNG', x, y, w, h);
    };

    drawLogo(opts.logoLeft, margin, 16, 76, 56);
    drawLogo(opts.logoRight, pageWidth - margin - 76, 10, 76, 76);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...text);
    doc.text(opts.title, pageWidth / 2, 36, { align: 'center' as any });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text(opts.subtitle, pageWidth / 2, 56, { align: 'center' as any });

    doc.setFontSize(9);
    doc.text(opts.generatedText, pageWidth / 2, 72, { align: 'center' as any });

    doc.setDrawColor(...line);
    doc.setLineWidth(1);
    doc.line(margin, headerH, pageWidth - margin, headerH);
  }

  private drawPdfFooter(doc: jsPDF, page: number, totalPages: number, title: string) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 52;

    const line: [number, number, number] = [229, 231, 235];
    const muted: [number, number, number] = [100, 116, 139];

    const footerY = pageHeight - 34;

    doc.setDrawColor(...line);
    doc.setLineWidth(1);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...muted);

    doc.text(`Gesti\u00f3n Acad\u00e9mica \u2022 ${title}`, margin, pageHeight - 18);
    doc.text(`P\u00e1gina ${page} / ${totalPages}`, pageWidth - margin, pageHeight - 18, { align: 'right' as any });
  }

  private hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '');
    const full = clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean.padStart(6, '0');
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  private renderPieChartImage(segments: PieSegment[], size = 160): string | null {
    const total = segments.reduce((sum, s) => sum + s.pct, 0);
    if (!total) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const center = size / 2;
    const radius = Math.floor(size / 2) - 2;
    let start = -Math.PI / 2;

    for (const seg of segments) {
      const angle = (seg.pct / 100) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      start += angle;
    }

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    return canvas.toDataURL('image/png');
  }

  private drawConclusionBlock(
    doc: jsPDF,
    title: string,
    text: string,
    x: number,
    y: number,
    width: number,
  ): number {
    const padding = 12;
    const headerH = 18;
    const lineH = 12;
    const maxTextW = width - padding * 2;
    const lines = doc.splitTextToSize(text, maxTextW) as string[];
    const contentH = headerH + lines.length * lineH + padding;

    doc.setFillColor(248, 250, 252);
    (doc as any).roundedRect(x, y, width, contentH, 10, 10, 'F');
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(1);
    (doc as any).roundedRect(x, y, width, contentH, 10, 10, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text(title, x + padding, y + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.text(lines, x + padding, y + 16 + lineH, { align: 'justify', maxWidth: maxTextW } as any);

    return contentH;
  }

  async exportarPdfConGraficos(): Promise<void> {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 52;
    const headerH = 92;
    const top = headerH + 22;
    const bottom = 54;
    const contentW = pageWidth - margin * 2;
    const gap = 16;
    const cardRadius = 12;
    const cardW = Math.floor((contentW - gap) / 2);

    const colors = {
      text: [17, 24, 39] as [number, number, number],
      muted: [100, 116, 139] as [number, number, number],
      line: [229, 231, 235] as [number, number, number],
      border: [209, 213, 219] as [number, number, number],
      cardFill: [248, 250, 252] as [number, number, number],
    };

    const [logoUta, logoFeh] = await Promise.all([
      this.loadImageAsDataURLSafe('assets/img/uta.png'),
      this.loadImageAsDataURLSafe('assets/img/feh.png'),
    ]);

    const now = new Date();
    const generatedText = `Generado: ${now.toLocaleString('es-CL')}`;
    const anioLabel = this.anioEgresoFiltroEmpleabilidad === 'ALL'
      ? 'Todos'
      : String(this.anioEgresoFiltroEmpleabilidad);

    const headerData = {
      title: 'ANÁLISIS DE ENCUESTAS DE EMPLEABILIDAD',
      subtitle: '',
      generatedText,
      logoLeft: logoUta,
      logoRight: logoFeh,
    };

    this.drawPdfHeader(doc, headerData);

    let y = top;

    const ensureSpace = (needed: number) => {
      if (y + needed <= pageHeight - bottom) return;
      doc.addPage();
      this.drawPdfHeader(doc, headerData);
      y = top;
    };

    ensureSpace(90);
    doc.setFillColor(...colors.cardFill);
    (doc as any).roundedRect(margin, y, contentW, 72, cardRadius, cardRadius, 'F');
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(1);
    (doc as any).roundedRect(margin, y, contentW, 72, cardRadius, cardRadius, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...colors.text);
    doc.text('Parámetros del reporte', margin + 14, y + 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...colors.muted);
    doc.text(`Año de egreso: ${anioLabel}`, margin + 14, y + 44);
    doc.text(`Total encuestas: ${this.empleabilidad.total}`, margin + 200, y + 44);

    y += 92;

    const conclusionEmpleabilidad = this.conclusionEmpleabilidadText || this.buildConclusionEmpleabilidad();
    const conclusionH = this.drawConclusionBlock(
      doc,
      'Conclusion IA (Empleabilidad)',
      conclusionEmpleabilidad,
      margin,
      y,
      contentW,
    );
    y += conclusionH + 18;

    doc.addPage();
    this.drawPdfHeader(doc, headerData);
    y = top;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...colors.text);
    doc.text('INDICADORES DE EMPLEABILIDAD', margin, y);
    y += 8;
    doc.setDrawColor(...colors.line);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + 260, y);
    y += 16;

    const charts = [
      { title: 'Con empleo vs sin empleo', data: this.empleabilidad.estadoLaboral },
      { title: 'Tiempo para encontrar trabajo', data: this.empleabilidad.tiempoEmpleo },
      { title: 'Empleo por género', data: this.empleabilidad.empleoGenero },
      { title: 'Sector laboral', data: this.empleabilidad.sector },
      { title: 'Tipo de cargo', data: this.empleabilidad.cargo },
      { title: 'Renta líquida mensual', data: this.empleabilidad.renta },
      { title: 'Tipo de institución educativa', data: this.empleabilidad.tipoInstitucion },
      { title: 'Pertinencia de la formación', data: this.empleabilidad.pertinencia },
      { title: 'Postgrado realizado', data: this.empleabilidad.postgrado },
      { title: 'Capacitación adicional', data: this.empleabilidad.capacitacion },
    ];

    const chartSize = 140;
    const padding = 12;
    const legendLineH = 12;
    const titleLineH = 12;
    const getTitleLines = (title: string, width: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      return doc.splitTextToSize(title, width - padding * 2) as string[];
    };
    const getCardLayout = (chart: { title: string; data: PieStat }, width: number) => {
      const titleLines = getTitleLines(chart.title, width);
      const titleH = titleLines.length * titleLineH;
      const height = padding + titleH + 6 + chartSize + 10 + (chart.data.segments.length * legendLineH + 6) + padding;
      return { height, titleLines };
    };

    const drawChartCard = (
      chart: { title: string; data: PieStat },
      layout: { height: number; titleLines: string[] },
      x: number,
      yPos: number,
      width: number,
    ) => {
      const { height, titleLines } = layout;

      doc.setFillColor(255, 255, 255);
      (doc as any).roundedRect(x, yPos, width, height, cardRadius, cardRadius, 'F');
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(1);
      (doc as any).roundedRect(x, yPos, width, height, cardRadius, cardRadius, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...colors.text);
      doc.text(titleLines, x + padding, yPos + padding + titleLineH);

      const imgData = this.renderPieChartImage(chart.data.segments, chartSize);
      const imgX = x + padding;
      const imgY = yPos + padding + titleLines.length * titleLineH + 6;
      if (imgData) {
        doc.addImage(imgData, 'PNG', imgX, imgY, chartSize, chartSize);
      }

      let ly = imgY + chartSize + 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...colors.text);

      for (const seg of chart.data.segments) {
        const [r, g, b] = this.hexToRgb(seg.color);
        doc.setFillColor(r, g, b);
        doc.rect(imgX, ly - 7, 8, 8, 'F');
        doc.setTextColor(...colors.text);
        doc.text(`${seg.label} (${seg.pct}%)`, imgX + 14, ly);
        ly += legendLineH;
      }

      doc.setFontSize(8);
      doc.setTextColor(...colors.muted);
      doc.text(`Total encuestas: ${chart.data.total}`, x + padding, yPos + height - 10);

      return height;
    };

    for (let i = 0; i < charts.length; i += 2) {
      const left = charts[i];
      const right = charts[i + 1];
      const leftLayout = getCardLayout(left, cardW);
      const rightLayout = right ? getCardLayout(right, cardW) : null;
      const rowHeight = Math.max(leftLayout.height, rightLayout ? rightLayout.height : 0);
      ensureSpace(rowHeight + gap);
      drawChartCard(left, leftLayout, margin, y, cardW);
      if (right && rightLayout) drawChartCard(right, rightLayout, margin + cardW + gap, y, cardW);
      y += rowHeight + gap;
    }

    const totalPages = (doc as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      this.drawPdfHeader(doc, headerData);
      this.drawPdfFooter(doc, i, totalPages, 'An\u00e1lisis de egresados');
    }

    const suffix = this.anioEgresoFiltroEmpleabilidad === 'ALL'
      ? 'todos'
      : `anio_${this.anioEgresoFiltroEmpleabilidad}`;
    doc.save(`analisis_encuestas_empleabilidad_${suffix}.pdf`);
  }

  exportarPdf(): void {
    this.exportarPdfConGraficos();
  }

  async exportarPdfTabla(): Promise<void> {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 52;
    const headerH = 92;
    const top = headerH + 22;
    const bottom = 54;
    const contentW = pageWidth - margin * 2;

    const colors = {
      text: [17, 24, 39] as [number, number, number],
      muted: [100, 116, 139] as [number, number, number],
      line: [229, 231, 235] as [number, number, number],
      border: [209, 213, 219] as [number, number, number],
      tableHead: [241, 245, 249] as [number, number, number],
      cardFill: [248, 250, 252] as [number, number, number],
    };

    const [logoUta, logoFeh] = await Promise.all([
      this.loadImageAsDataURLSafe('assets/img/uta.png'),
      this.loadImageAsDataURLSafe('assets/img/feh.png'),
    ]);

    const now = new Date();
    const generatedText = `Generado: ${now.toLocaleString('es-CL')}`;
    const anioLabel = this.anioEgresoFiltroEmpleabilidad === 'ALL'
      ? 'Todos'
      : String(this.anioEgresoFiltroEmpleabilidad);

    const headerData = {
      title: 'AN\u00c1LISIS DE ENCUESTAS DE EMPLEABILIDAD',
      subtitle: 'Empleabilidad',
      generatedText,
      logoLeft: logoUta,
      logoRight: logoFeh,
    };

    this.drawPdfHeader(doc, headerData);

    let y = top;

    const ensureSpace = (needed: number) => {
      if (y + needed <= pageHeight - bottom) return;
      doc.addPage();
      this.drawPdfHeader(doc, headerData);
      y = top;
    };

    ensureSpace(90);
    doc.setFillColor(...colors.cardFill);
    (doc as any).roundedRect(margin, y, contentW, 72, 12, 12, 'F');
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(1);
    (doc as any).roundedRect(margin, y, contentW, 72, 12, 12, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...colors.text);
    doc.text('Parámetros del reporte', margin + 14, y + 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...colors.muted);
    doc.text(`Año de egreso: ${anioLabel}`, margin + 14, y + 44);
    doc.text(`Total encuestas: ${this.empleabilidad.total}`, margin + 200, y + 44);

    y += 92;

    const conclusionEmpleabilidad = this.conclusionEmpleabilidadText || this.buildConclusionEmpleabilidad();
    const conclusionH = this.drawConclusionBlock(
      doc,
      'Conclusion IA (Empleabilidad)',
      conclusionEmpleabilidad,
      margin,
      y,
      contentW,
    );
    y += conclusionH + 18;

    doc.addPage();
    this.drawPdfHeader(doc, headerData);
    y = top;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
    doc.setTextColor(...colors.text);
    doc.text('DETALLE DE INDICADORES', margin, y);
    y += 8;
    doc.setDrawColor(...colors.line);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + 240, y);
    y += 16;

    const charts = [
      { title: 'Con empleo vs sin empleo', data: this.empleabilidad.estadoLaboral },
      { title: 'Tiempo para encontrar trabajo', data: this.empleabilidad.tiempoEmpleo },
      { title: 'Empleo por género', data: this.empleabilidad.empleoGenero },
      { title: 'Sector laboral', data: this.empleabilidad.sector },
      { title: 'Tipo de cargo', data: this.empleabilidad.cargo },
      { title: 'Renta líquida mensual', data: this.empleabilidad.renta },
      { title: 'Tipo de institución educativa', data: this.empleabilidad.tipoInstitucion },
      { title: 'Pertinencia de la formación', data: this.empleabilidad.pertinencia },
      { title: 'Postgrado realizado', data: this.empleabilidad.postgrado },
      { title: 'Capacitación adicional', data: this.empleabilidad.capacitacion },
    ];

    for (const chart of charts) {
      const titleLines = doc.splitTextToSize(chart.title, contentW) as string[];
      const titleLineH = 12;
      ensureSpace(titleLines.length * titleLineH + 24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...colors.text);
      doc.text(titleLines, margin, y);
      y += titleLines.length * titleLineH - 4;

      const rows = chart.data.segments.map((seg) => [
        seg.label,
        `${seg.pct}%`,
        `${seg.count}`,
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Categor\u00eda', 'Porcentaje', 'Respuestas']],
        body: rows as any,
        margin: { left: margin, right: margin, top, bottom },
        tableWidth: contentW,
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: 6,
          textColor: colors.text as any,
          lineColor: colors.line as any,
          lineWidth: 0.8,
        },
        headStyles: {
          fillColor: colors.tableHead as any,
          textColor: colors.text as any,
          fontStyle: 'bold',
          lineColor: colors.border as any,
          lineWidth: 1,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] as any },
        columnStyles: {
          0: { cellWidth: Math.floor(contentW * 0.5) },
          1: { cellWidth: Math.floor(contentW * 0.25), halign: 'right' as any },
          2: { cellWidth: Math.floor(contentW * 0.25), halign: 'right' as any },
        },
      });

      y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 14 : y + 14;
    }

    const totalPages = (doc as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      this.drawPdfHeader(doc, headerData);
      this.drawPdfFooter(doc, i, totalPages, 'An\u00e1lisis de egresados');
    }

    const suffix = this.anioEgresoFiltroEmpleabilidad === 'ALL'
      ? 'todos'
      : `anio_${this.anioEgresoFiltroEmpleabilidad}`;
    doc.save(`analisis_encuestas_empleabilidad_tabla_${suffix}.pdf`);
  }

  async exportarPdfAcreditacionConGraficos(): Promise<void> {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 52;
    const headerH = 92;
    const top = headerH + 22;
    const bottom = 54;
    const contentW = pageWidth - margin * 2;
    const gap = 16;
    const cardRadius = 12;
    const cardW = Math.floor((contentW - gap) / 2);

    const colors = {
      text: [17, 24, 39] as [number, number, number],
      muted: [100, 116, 139] as [number, number, number],
      line: [229, 231, 235] as [number, number, number],
      border: [209, 213, 219] as [number, number, number],
      cardFill: [248, 250, 252] as [number, number, number],
    };

    const [logoUta, logoFeh] = await Promise.all([
      this.loadImageAsDataURLSafe('assets/img/uta.png'),
      this.loadImageAsDataURLSafe('assets/img/feh.png'),
    ]);

    const now = new Date();
    const generatedText = `Generado: ${now.toLocaleString('es-CL')}`;

    const headerData = {
      title: 'ANÁLISIS DE ENCUESTAS DE EGRESADOS',
      subtitle: '',
      generatedText,
      logoLeft: logoUta,
      logoRight: logoFeh,
    };

    this.drawPdfHeader(doc, headerData);

    let y = top;
    const ensureSpace = (needed: number) => {
      if (y + needed <= pageHeight - bottom) return;
      doc.addPage();
      this.drawPdfHeader(doc, headerData);
      y = top;
    };

    ensureSpace(90);
    doc.setFillColor(...colors.cardFill);
    (doc as any).roundedRect(margin, y, contentW, 72, cardRadius, cardRadius, 'F');
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(1);
    (doc as any).roundedRect(margin, y, contentW, 72, cardRadius, cardRadius, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...colors.text);
    doc.text('Resumen del reporte', margin + 14, y + 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...colors.muted);
    doc.text(`Total encuestas: ${this.acreditacion.total}`, margin + 14, y + 44);
    doc.text(`Promedio Likert: ${this.acreditacion.promedioLikert}%`, margin + 200, y + 44);

    y += 92;

    const conclusionAcreditacion = this.conclusionAcreditacionText || this.buildConclusionAcreditacion();
    const conclusionH = this.drawConclusionBlock(
      doc,
      'Conclusion IA (Egresados)',
      conclusionAcreditacion,
      margin,
      y,
      contentW,
    );
    y += conclusionH + 18;

    doc.addPage();
    this.drawPdfHeader(doc, headerData);
    y = top;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...colors.text);
    doc.text('INDICADORES DE EGRESADOS', margin, y);
    y += 8;
    doc.setDrawColor(...colors.line);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + 240, y);
    y += 16;

    const charts = this.acreditacion.preguntas.map((q) => ({
      title: q.label,
      data: q.stat,
    }));

    const chartSize = 140;
    const padding = 12;
    const legendLineH = 12;
    const titleLineH = 12;
    const getTitleLines = (title: string, width: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      return doc.splitTextToSize(title, width - padding * 2) as string[];
    };
    const getCardLayout = (chart: { title: string; data: PieStat }, width: number) => {
      const titleLines = getTitleLines(chart.title, width);
      const titleH = titleLines.length * titleLineH;
      const height = padding + titleH + 6 + chartSize + 10 + (chart.data.segments.length * legendLineH + 6) + padding;
      return { height, titleLines };
    };

    const drawChartCard = (
      chart: { title: string; data: PieStat },
      layout: { height: number; titleLines: string[] },
      x: number,
      yPos: number,
      width: number,
    ) => {
      const { height, titleLines } = layout;

      doc.setFillColor(255, 255, 255);
      (doc as any).roundedRect(x, yPos, width, height, cardRadius, cardRadius, 'F');
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(1);
      (doc as any).roundedRect(x, yPos, width, height, cardRadius, cardRadius, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...colors.text);
      doc.text(titleLines, x + padding, yPos + padding + titleLineH);

      const imgData = this.renderPieChartImage(chart.data.segments, chartSize);
      const imgX = x + padding;
      const imgY = yPos + padding + titleLines.length * titleLineH + 6;
      if (imgData) {
        doc.addImage(imgData, 'PNG', imgX, imgY, chartSize, chartSize);
      }

      let ly = imgY + chartSize + 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...colors.text);

      for (const seg of chart.data.segments) {
        const [r, g, b] = this.hexToRgb(seg.color);
        doc.setFillColor(r, g, b);
        doc.rect(imgX, ly - 7, 8, 8, 'F');
        doc.setTextColor(...colors.text);
        doc.text(`${seg.label} (${seg.pct}%)`, imgX + 14, ly);
        ly += legendLineH;
      }

      doc.setFontSize(8);
      doc.setTextColor(...colors.muted);
      doc.text(`Total encuestas: ${chart.data.total}`, x + padding, yPos + height - 10);

      return height;
    };

    for (let i = 0; i < charts.length; i += 2) {
      const left = charts[i];
      const right = charts[i + 1];
      const leftLayout = getCardLayout(left, cardW);
      const rightLayout = right ? getCardLayout(right, cardW) : null;
      const rowHeight = Math.max(leftLayout.height, rightLayout ? rightLayout.height : 0);
      ensureSpace(rowHeight + gap);
      drawChartCard(left, leftLayout, margin, y, cardW);
      if (right && rightLayout) drawChartCard(right, rightLayout, margin + cardW + gap, y, cardW);
      y += rowHeight + gap;
    }

    const totalPages = (doc as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      this.drawPdfHeader(doc, headerData);
      this.drawPdfFooter(doc, i, totalPages, 'Análisis de egresados');
    }

    doc.save('analisis_encuestas_egresados.pdf');
  }

  async exportarPdfAcreditacionTabla(): Promise<void> {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 52;
    const headerH = 92;
    const top = headerH + 22;
    const bottom = 54;
    const contentW = pageWidth - margin * 2;

    const colors = {
      text: [17, 24, 39] as [number, number, number],
      muted: [100, 116, 139] as [number, number, number],
      line: [229, 231, 235] as [number, number, number],
      border: [209, 213, 219] as [number, number, number],
      tableHead: [241, 245, 249] as [number, number, number],
      cardFill: [248, 250, 252] as [number, number, number],
    };

    const [logoUta, logoFeh] = await Promise.all([
      this.loadImageAsDataURLSafe('assets/img/uta.png'),
      this.loadImageAsDataURLSafe('assets/img/feh.png'),
    ]);

    const now = new Date();
    const generatedText = `Generado: ${now.toLocaleString('es-CL')}`;

    const headerData = {
      title: 'ANÁLISIS DE ENCUESTAS DE EGRESADOS',
      subtitle: '',
      generatedText,
      logoLeft: logoUta,
      logoRight: logoFeh,
    };

    this.drawPdfHeader(doc, headerData);

    let y = top;
    const ensureSpace = (needed: number) => {
      if (y + needed <= pageHeight - bottom) return;
      doc.addPage();
      this.drawPdfHeader(doc, headerData);
      y = top;
    };

    ensureSpace(90);
    doc.setFillColor(...colors.cardFill);
    (doc as any).roundedRect(margin, y, contentW, 72, 12, 12, 'F');
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(1);
    (doc as any).roundedRect(margin, y, contentW, 72, 12, 12, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...colors.text);
    doc.text('Resumen del reporte', margin + 14, y + 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...colors.muted);
    doc.text(`Total encuestas: ${this.acreditacion.total}`, margin + 14, y + 44);
    doc.text(`Promedio Likert: ${this.acreditacion.promedioLikert}%`, margin + 200, y + 44);

    y += 92;

    const conclusionAcreditacion = this.conclusionAcreditacionText || this.buildConclusionAcreditacion();
    const conclusionH = this.drawConclusionBlock(
      doc,
      'Conclusion IA (Egresados)',
      conclusionAcreditacion,
      margin,
      y,
      contentW,
    );
    y += conclusionH + 18;

    doc.addPage();
    this.drawPdfHeader(doc, headerData);
    y = top;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...colors.text);
    doc.text('DETALLE DE INDICADORES', margin, y);
    y += 8;
    doc.setDrawColor(...colors.line);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + 240, y);
    y += 16;

    for (const chart of this.acreditacion.preguntas) {
      const titleLines = doc.splitTextToSize(chart.label, contentW) as string[];
      const titleLineH = 12;
      ensureSpace(titleLines.length * titleLineH + 24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...colors.text);
      doc.text(titleLines, margin, y);
      y += titleLines.length * titleLineH - 4;

      const rows = chart.stat.segments.map((seg) => [
        seg.label,
        `${seg.pct}%`,
        `${seg.count}`,
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Categoria', 'Porcentaje', 'Respuestas']],
        body: rows as any,
        margin: { left: margin, right: margin, top, bottom },
        tableWidth: contentW,
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: 6,
          textColor: colors.text as any,
          lineColor: colors.line as any,
          lineWidth: 0.8,
        },
        headStyles: {
          fillColor: colors.tableHead as any,
          textColor: colors.text as any,
          fontStyle: 'bold',
          lineColor: colors.border as any,
          lineWidth: 1,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] as any },
        columnStyles: {
          0: { cellWidth: Math.floor(contentW * 0.5) },
          1: { cellWidth: Math.floor(contentW * 0.25), halign: 'right' as any },
          2: { cellWidth: Math.floor(contentW * 0.25), halign: 'right' as any },
        },
      });

      y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 14 : y + 14;
    }

    const totalPages = (doc as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      this.drawPdfHeader(doc, headerData);
      this.drawPdfFooter(doc, i, totalPages, 'Análisis de egresados');
    }

    doc.save('analisis_encuestas_egresados_tabla.pdf');
  }

  private buildAcreditacionStats(encuestas: EgresadoEncuestaRow[]): AcreditacionStats {
    const total = encuestas.length;
    const promedioLikert = this.calcLikertPromedio(encuestas);
    const totalLikertRespuestas = this.countLikertRespuestas(encuestas);
    const countPerfilEgreso = this.countAgreement(encuestas, 'secciones.perfilEgreso.p2');
    const countRecursos = this.countAgreement(encuestas, 'secciones.gestionRecursos.p13');
    const countMejora = this.countAgreement(encuestas, 'secciones.autorregulacion.p18');
    const countAutoevaluacion = this.countAgreement(encuestas, 'secciones.autorregulacion.p17');
    const countComentarios = this.countConComentarios(encuestas);

    const preguntas = this.acreditacionPreguntas.map((q) => ({
      key: q.key,
      label: q.label,
      stat: this.buildLikertStat(encuestas, q.key),
    }));

    return {
      total,
      promedioLikert,
      totalLikertRespuestas,
      pctPerfilEgreso: this.pct(countPerfilEgreso, total),
      countPerfilEgreso,
      pctRecursos: this.pct(countRecursos, total),
      countRecursos,
      pctMejora: this.pct(countMejora, total),
      countMejora,
      pctAutoevaluacion: this.pct(countAutoevaluacion, total),
      countAutoevaluacion,
      pctComentarios: this.pct(countComentarios, total),
      countComentarios,
      preguntas,
    };
  }

  private getRespuesta(encuesta: EgresadoEncuestaRow, key: string): string | null {
    const respuestas = encuesta.respuestas || [];
    for (const r of respuestas) {
      const desc = r?.pregunta?.descripcion ?? '';
      if (desc === key) {
        return r?.alternativa?.descripcion ?? r?.respuestaAbierta ?? null;
      }
    }
    return null;
  }

  private countByRespuesta(
    encuestas: EgresadoEncuestaRow[],
    key: string,
    target: string,
  ): number {
    return encuestas.filter((e) => this.getRespuesta(e, key) === target).length;
  }

  private countAgreement(encuestas: EgresadoEncuestaRow[], key: string): number {
    return encuestas.filter((e) => {
      const value = this.getRespuesta(e, key);
      return value === 'De acuerdo' || value === 'Muy de acuerdo';
    }).length;
  }

  private calcLikertPromedio(encuestas: EgresadoEncuestaRow[]): number {
    let total = 0;
    let count = 0;
    for (const encuesta of encuestas) {
      for (const r of encuesta.respuestas || []) {
        const key = r?.pregunta?.descripcion ?? '';
        if (!key.startsWith('secciones.')) continue;
        const value = r?.alternativa?.descripcion ?? r?.respuestaAbierta ?? '';
        const score = this.likertMap[value];
        if (!score) continue;
        total += score;
        count += 1;
      }
    }
    if (!count) return 0;
    return Math.round((total / count / 5) * 100);
  }

  private countLikertRespuestas(encuestas: EgresadoEncuestaRow[]): number {
    let count = 0;
    for (const encuesta of encuestas) {
      for (const r of encuesta.respuestas || []) {
        const key = r?.pregunta?.descripcion ?? '';
        if (!key.startsWith('secciones.')) continue;
        const value = r?.alternativa?.descripcion ?? r?.respuestaAbierta ?? '';
        if (this.likertMap[value]) count += 1;
      }
    }
    return count;
  }

  private countConComentarios(encuestas: EgresadoEncuestaRow[]): number {
    return encuestas.filter((e) =>
      (e.respuestas || []).some((r) => {
        const key = r?.pregunta?.descripcion ?? '';
        const value = (r?.respuestaAbierta ?? '').trim();
        return key.startsWith('abiertas.') && value.length > 0;
      }),
    ).length;
  }

  private pct(value: number, total: number): number {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  }

  private buildPieStat(parts: Array<{ label: string; count: number; color: string }>): PieStat {
    const total = parts.reduce((sum, p) => sum + p.count, 0);
    const segments = parts.map((p) => ({
      label: p.label,
      count: p.count,
      pct: total ? Math.round((p.count / total) * 100) : 0,
      color: p.color,
    }));

    if (total && segments.length) {
      const pctSum = segments.reduce((sum, s) => sum + s.pct, 0);
      const diff = 100 - pctSum;
      segments[segments.length - 1].pct += diff;
    }

    return { total, segments };
  }

  private buildLikertStat(encuestas: EgresadoEncuestaRow[], key: string): PieStat {
    const palette = ['#dc2626', '#f97316', '#eab308', '#22c55e', '#16a34a'];
    const parts = this.likertLabels.map((label, idx) => ({
      label,
      count: this.countByRespuesta(encuestas, key, label),
      color: palette[idx] ?? '#94a3b8',
    }));
    return this.buildPieStat(parts);
  }

  private getTopSegment(stat: PieStat): PieSegment | null {
    if (!stat.segments.length) return null;
    return stat.segments.reduce((best, current) => {
      if (!best) return current;
      if (current.pct > best.pct) return current;
      if (current.pct === best.pct && current.count > best.count) return current;
      return best;
    }, null as PieSegment | null);
  }

  private getSecondSegment(stat: PieStat): PieSegment | null {
    if (stat.segments.length < 2) return null;
    const sorted = [...stat.segments].sort((a, b) => {
      if (b.pct !== a.pct) return b.pct - a.pct;
      return b.count - a.count;
    });
    return sorted[1] ?? null;
  }

  private buildConclusionEmpleabilidad(): string {
    if (!this.empleabilidad.total) {
      return 'No hay encuestas de empleabilidad disponibles para generar una conclusion.';
    }

    const total = this.empleabilidad.total;
    const estado = this.getTopSegment(this.empleabilidad.estadoLaboral);
    const estadoAlt = this.getSecondSegment(this.empleabilidad.estadoLaboral);
    const tiempo = this.getTopSegment(this.empleabilidad.tiempoEmpleo);
    const sector = this.getTopSegment(this.empleabilidad.sector);
    const cargo = this.getTopSegment(this.empleabilidad.cargo);
    const renta = this.getTopSegment(this.empleabilidad.renta);
    const pertinencia = this.getTopSegment(this.empleabilidad.pertinencia);
    const postgrado = this.getTopSegment(this.empleabilidad.postgrado);
    const capacitacion = this.getTopSegment(this.empleabilidad.capacitacion);

    const partes: string[] = [];
    if (estado) {
      const lead = estado.pct >= 60 ? 'una insercion laboral consolidada' : 'un escenario laboral heterogeneo';
      const gap = estadoAlt ? Math.max(0, estado.pct - estadoAlt.pct) : 0;
      const gapTxt = estadoAlt && gap >= 15 ? `, con una brecha relevante de ${gap} pts` : '';
      partes.push(
        `El panorama general muestra ${lead}${gapTxt}, lo que sugiere ${estado.label === 'Con empleo'
          ? 'buen nivel de empleabilidad para la cohorte analizada'
          : 'la necesidad de fortalecer la vinculacion con el medio'}.`,
      );
    }
    if (tiempo) {
      const rapidez = tiempo.label.includes('Menos de 2') || tiempo.label.includes('Menos de 6')
        ? 'accesible'
        : 'lenta';
      partes.push(
        `La velocidad de insercion se percibe ${rapidez}, lo que indica que el acceso al primer empleo ${rapidez === 'accesible'
          ? 'ocurre en plazos razonables para una parte importante de los egresados'
          : 'podria requerir apoyos adicionales de empleabilidad'}.`,
      );
    }
    if (sector && cargo) {
      partes.push(
        `La concentracion en el sector "${sector.label}" y en cargos "${cargo.label}" sugiere un perfil ocupacional dominante, util para ajustar el curriculum y las alianzas con empleadores.`,
      );
    }
    if (renta) {
      partes.push(
        `La renta mas frecuente permite dimensionar la calidad de insercion economica y sirve como referencia para metas de mejora en empleabilidad.`,
      );
    }
    if (pertinencia) {
      const positiva = pertinencia.label.includes('De acuerdo') || pertinencia.label.includes('Muy de acuerdo');
      partes.push(
        `La pertinencia percibida del plan formativo es ${positiva ? 'favorable' : 'dispersa'}, lo que ${positiva
          ? 'respalda la alineacion entre formacion y trabajo'
          : 'abre oportunidades para reforzar competencias clave'}.`,
      );
    }
    if (postgrado && capacitacion) {
      const desarrollo = postgrado.label === 'Si' || capacitacion.label === 'Si'
        ? 'una actitud activa de actualizacion'
        : 'una oportunidad para impulsar rutas de especializacion';
      partes.push(
        `En desarrollo profesional se observa ${desarrollo}, lo que orienta acciones de continuidad de estudios.`,
      );
    }

    return partes.join(' ');
  }

  private buildConclusionAcreditacion(): string {
    if (!this.acreditacion.total) {
      return 'No hay encuestas de egresados para generar una conclusion de calidad formativa.';
    }

    const total = this.acreditacion.total;
    const promedio = this.acreditacion.promedioLikert;
    const fortalezas = [
      { label: 'Perfil de egreso', pct: this.acreditacion.pctPerfilEgreso },
      { label: 'Recursos e infraestructura', pct: this.acreditacion.pctRecursos },
      { label: 'Mejora continua', pct: this.acreditacion.pctMejora },
      { label: 'Autoevaluacion', pct: this.acreditacion.pctAutoevaluacion },
    ].sort((a, b) => b.pct - a.pct);

    const top = fortalezas[0];
    const bottom = fortalezas[fortalezas.length - 1];
    const brecha = Math.max(0, top.pct - bottom.pct);

    const nivel = promedio >= 80 ? 'muy alto' : promedio >= 60 ? 'adecuado' : 'debil';
    const partes = [
      `El nivel de satisfaccion global es ${nivel}, lo que indica que la experiencia formativa ${nivel === 'muy alto'
        ? 'cumple ampliamente las expectativas'
        : nivel === 'adecuado'
          ? 'es positiva pero con espacios claros de mejora'
          : 'requiere intervenciones prioritarias'
      }.`,
      `La principal fortaleza se concentra en "${top.label}", mientras que "${bottom.label}" aparece como el foco mas debil; la brecha de ${brecha} pts sugiere donde focalizar recursos.`,
      `Los indicadores de mejora continua y autoevaluacion muestran el grado de cultura de calidad, y ayudan a priorizar acciones institucionales.`,
      `La presencia de comentarios abiertos aporta evidencia cualitativa clave para complementar los indicadores cuantitativos.`,
    ];

    return partes.join(' ');
  }

  generarConclusionEmpleabilidad(): void {
    if (this.generatingEmpleabilidad) return;
    this.generatingEmpleabilidad = true;
    this.showEmpleabilidadConclusion = true;
    this.api.generarConclusion({
      tipo: 'EMPLEABILIDAD',
      anioEgreso: this.anioEgresoFiltroEmpleabilidad,
      stats: this.empleabilidad,
    }).subscribe({
      next: (data) => {
        const text = (data?.texto ?? '').trim();
        this.conclusionEmpleabilidadText = text || this.buildConclusionEmpleabilidad();
        this.generatingEmpleabilidad = false;
      },
      error: () => {
        this.conclusionEmpleabilidadText = this.buildConclusionEmpleabilidad();
        this.generatingEmpleabilidad = false;
      },
    });
  }

  generarConclusionAcreditacion(): void {
    if (this.generatingAcreditacion) return;
    this.generatingAcreditacion = true;
    this.showAcreditacionConclusion = true;
    this.api.generarConclusion({
      tipo: 'ACREDITACION',
      stats: this.acreditacion,
    }).subscribe({
      next: (data) => {
        const text = (data?.texto ?? '').trim();
        this.conclusionAcreditacionText = text || this.buildConclusionAcreditacion();
        this.generatingAcreditacion = false;
      },
      error: () => {
        this.conclusionAcreditacionText = this.buildConclusionAcreditacion();
        this.generatingAcreditacion = false;
      },
    });
  }

  private cargarConclusionesGuardadas(): void {
    if (!this.generatingEmpleabilidad) {
      this.conclusionEmpleabilidadText = '';
      this.showEmpleabilidadConclusion = false;
    }
    if (!this.generatingAcreditacion) {
      this.conclusionAcreditacionText = '';
      this.showAcreditacionConclusion = false;
    }

    this.api.obtenerConclusion('EMPLEABILIDAD', this.anioEgresoFiltroEmpleabilidad).subscribe({
      next: (data) => {
        const text = (data?.texto ?? '').trim();
        if (text) {
          this.conclusionEmpleabilidadText = text;
          this.showEmpleabilidadConclusion = true;
        }
      },
    });

    this.api.obtenerConclusion('ACREDITACION', this.anioEgresoFiltroAcreditacion).subscribe({
      next: (data) => {
        const text = (data?.texto ?? '').trim();
        if (text) {
          this.conclusionAcreditacionText = text;
          this.showAcreditacionConclusion = true;
        }
      },
    });
  }

  get conclusionEmpleabilidad(): string {
    return this.conclusionEmpleabilidadText || this.buildConclusionEmpleabilidad();
  }

  get conclusionAcreditacion(): string {
    return this.conclusionAcreditacionText || this.buildConclusionAcreditacion();
  }

  buildPieGradient(segments: PieSegment[]): string {
    if (!segments.length) return 'conic-gradient(#e2e8f0 0 100%)';
    const totalPct = segments.reduce((sum, s) => sum + s.pct, 0);
    if (!totalPct) return 'conic-gradient(#e2e8f0 0 100%)';

    let current = 0;
    const stops = segments.map((s) => {
      const start = current;
      current += s.pct;
      return `${s.color} ${start}% ${current}%`;
    });

    if (current < 100) {
      stops.push(`#e2e8f0 ${current}% 100%`);
    }

    return `conic-gradient(${stops.join(', ')})`;
  }
}
