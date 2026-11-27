import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import {
  HorarioApiService,
  CarreraDTO,
  PlanDTO,
  AsignaturaDTO,
  DiaSemana,
  BloqueProtegidoDTO,
  BloqueGrillaDTO,
} from '../../services/horario-api.service';
import {
  ActividadDTO,
  CruceDocenteDTO,
  CruceProtegidoDTO,
  CruceSalaDTO,
  MotivoNoAsignada,
  NoAsignadaDTO,
  PropuestaApiService,
  PropuestaDTO,
  ValidacionDTO,
} from '../../services/propuesta-api.service';
import {
  HorarioGrillaComponent,
  CeldaGrilla,
  MovimientoCelda,
} from './horario-grilla.component';

function formatoAlcanceLegible(bp: BloqueProtegidoDTO): string {
  switch (bp.alcance) {
    case 'UNIVERSIDAD':
      return 'Universidad';
    case 'FACULTAD':
      return 'Facultad';
    case 'CARRERA':
      return `Carrera ${bp.codigo_carrera ?? ''}`.trim();
    case 'ESTUDIANTES':
      return `Estudiantes ${bp.codigo_carrera ?? ''} (${bp.semestre ?? ''}° sem)`.trim();
    case 'PRACTICA_PREPRACTICA':
      return `Práctica ${bp.semestre ?? ''}° semestre`.trim();
    case 'ACADEMICOS':
      return bp.contrato ? `Académicos (${bp.contrato})` : 'Académicos';
    case 'ACADEMICO_INDIVIDUAL':
      return bp.profesor?.usuario?.nombre
        ? `Docente: ${bp.profesor.usuario.nombre}`
        : 'Académico individual';
    default:
      return bp.alcance;
  }
}

const DIAS: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
const idDia = (d: DiaSemana) => DIAS.indexOf(d) + 1;

// Año de la propuesta que se muestra (mismo criterio que Carga docente)
const YEAR_PROPUESTA = 2026;

const MOTIVOS: Record<MotivoNoAsignada, string> = {
  SIN_CARGA: 'Sin carga docente',
  SIN_BLOQUES: 'Sin horas semanales',
  SIN_SALA: 'Sin sala disponible',
  SIN_DISPONIBILIDAD: 'Sin disponibilidad del docente',
  SIN_BLOQUE_LIBRE: 'Sin bloque libre',
};

// Un nivel, o todos los niveles pares o impares (un semestre del año)
type FiltroSemestre = number | 'PARES' | 'IMPARES' | 'TODOS';

// Cómo se arma una grilla: por nivel (carrera y plan), por sala o por docente
type ModoGrilla = 'nivel' | 'sala' | 'docente';

// CAL-F01: en cada día y bloque, qué salas están libres y cuáles ocupadas (y con qué)
interface CeldaOcupacion {
  id_dia: number;
  // Todas las salas, siempre en el mismo orden, para que cada una quede en el mismo lugar en todas las celdas
  salas: { id_sala: number; nombre: string; libre: boolean; detalle: string }[];
  libres: number;
}

// Grilla que se dibuja: una por nivel, o una sola con todas las clases de una sala o de un docente
interface GrillaVista {
  clave: string;
  // Con "Todos los semestres" cada nivel usa la propuesta de su semestre: se arrastra si esa está en borrador
  editable: boolean;
  titulo: string;
  subtitulo: string;
  celdas: CeldaGrilla[];
}

@Component({
  standalone: true,
  selector: 'app-horario-grilla-page',
  templateUrl: './horario-grilla-page.component.html',
  styleUrls: ['./horario-grilla-page.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatAutocompleteModule,
    MatInputModule,
    MatButtonToggleModule,
    MatSlideToggleModule,
    HorarioGrillaComponent,
  ],
})
export class HorarioGrillaPageComponent implements OnInit {
  private horarioApi = inject(HorarioApiService);
  private propuestaApi = inject(PropuestaApiService);
  private snack = inject(MatSnackBar);

  carreras: CarreraDTO[] = [];
  planesDisponibles: PlanDTO[] = [];

  idCarreraSeleccionada: string | number | null = null;
  idPlanSeleccionado: number | null = null;
  semestreSeleccionado: FiltroSemestre = 2; // Default a 2 para la demo
  // Con una sala elegida se ve una sola grilla con todas sus clases del semestre
  salaSeleccionada = 0; // 0: todas las salas
  // CAL-F03: con un docente elegido se ve una sola grilla con todas sus clases del semestre
  docenteSeleccionado = 0; // 0: ninguno
  textoDocente = '';
  // CAL-F01: "horario" (grillas) o "salas" (salas libres por bloque)
  vista: 'horario' | 'salas' = 'horario';
  // En la vista de salas libres, ocultar las ocupadas
  soloLibres = false;
  // La tarjeta de la propuesta se abre con "Generar horario" y se cierra al cerrar el horario
  mostrarPropuesta = false;
  confirmandoGeneracion = false;
  // Con "Todos los semestres": semestre del año que se gestiona en la tarjeta, y la propuesta del otro
  periodoTodos: 1 | 2 = 2;
  propuestaOtra: PropuestaDTO | null = null;
  bloquesGrilla: BloqueGrillaDTO[] = [];

  readonly SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly YEAR = YEAR_PROPUESTA;
  readonly MOTIVOS = MOTIVOS;
  readonly DIAS_OPCIONES = [
    { id: 1, label: 'Lunes' },
    { id: 2, label: 'Martes' },
    { id: 3, label: 'Miércoles' },
    { id: 4, label: 'Jueves' },
    { id: 5, label: 'Viernes' },
  ];
  readonly BLOQUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  cargando = false;
  guardando = false;
  generando = false;
  verPendientes = false;
  verSinCarga = false;

  // Asignaturas de todo el plan; la vista toma las de los niveles elegidos
  asignaturasPlan: AsignaturaDTO[] = [];
  protegidosPorNivel: Record<number, BloqueProtegidoDTO[]> = {};
  propuesta: PropuestaDTO | null = null;
  grillas: GrillaVista[] = [];

  // GEN-F02: clases de la celda elegida y a dónde moverlas desde el panel
  seleccion: ActividadDTO[] = [];
  destinos: Record<string, { id_dia: number; bloque: number; id_sala: number | null }> = {};

  ngOnInit(): void {
    this.cargarCarreras();
    this.horarioApi.getGrilla().subscribe({ next: (b) => (this.bloquesGrilla = b) });
  }

  // 1er semestre del año: niveles impares; 2do semestre: niveles pares
  get periodo(): number {
    const s = this.semestreSeleccionado;
    if (s === 'TODOS') return this.periodoTodos;
    if (s === 'PARES') return 2;
    if (s === 'IMPARES') return 1;
    return s % 2 === 0 ? 2 : 1;
  }

  get nombrePeriodo(): string {
    return `${this.periodo === 2 ? '2do' : '1er'} semestre ${this.YEAR}`;
  }

  get etiquetaSemestre(): string {
    const s = this.semestreSeleccionado;
    if (s === 'TODOS') return 'Todos los semestres';
    if (s === 'PARES') return 'Semestres pares';
    if (s === 'IMPARES') return 'Semestres impares';
    return `Semestre ${s}`;
  }

  get generada(): boolean {
    return !!this.propuesta?.generado_en;
  }

  get cerrado(): boolean {
    return this.propuesta?.estado === 'CERRADO';
  }

  // Solo se arrastra sobre una propuesta generada que no esté cerrada
  get editable(): boolean {
    return this.generada && !this.cerrado && !this.guardando;
  }

  get salas() {
    return this.propuesta?.salas ?? [];
  }

  get salaActual() {
    return this.salas.find((s) => s.id_sala === this.salaSeleccionada);
  }

  // Clases de una sala en el semestre elegido, de cualquier carrera y plan.
  // Con un nivel elegido (ej. Semestre 4) solo las de ese nivel; con pares o impares, todas
  clasesEnSala(id_sala: number): ActividadDTO[] {
    const nivel = this.semestreSeleccionado;
    return (this.propuesta?.actividades ?? []).filter(
      (a) => a.id_sala === id_sala && (typeof nivel !== 'number' || a.nivel === nivel),
    );
  }

  // ---------- CAL-F03: horario por docente ----------

  // Docentes con clases en la propuesta del semestre, para buscarlos por nombre
  get docentes(): { id_usuario: number; nombre: string }[] {
    const vistos = new Map<number, string>();
    for (const a of this.propuesta?.actividades ?? []) {
      for (const d of a.docentes) vistos.set(d.id_usuario, d.nombre);
    }
    return [...vistos]
      .map(([id_usuario, nombre]) => ({ id_usuario, nombre }))
      .sort((x, y) => x.nombre.localeCompare(y.nombre));
  }

  get docentesFiltrados() {
    const q = this.textoDocente.trim().toLowerCase();
    return q ? this.docentes.filter((d) => d.nombre.toLowerCase().includes(q)) : this.docentes;
  }

  get docenteActual() {
    return this.docentes.find((d) => d.id_usuario === this.docenteSeleccionado);
  }

  // Clases de un docente en el semestre elegido, con el mismo criterio que la vista por sala
  clasesDeDocente(id_usuario: number): ActividadDTO[] {
    const nivel = this.semestreSeleccionado;
    return (this.propuesta?.actividades ?? []).filter(
      (a) =>
        a.docentes.some((d) => d.id_usuario === id_usuario) &&
        (typeof nivel !== 'number' || a.nivel === nivel),
    );
  }

  // Docente y sala son excluyentes: elegir uno quita el otro
  seleccionarDocente(d: { id_usuario: number; nombre: string }): void {
    this.docenteSeleccionado = d.id_usuario;
    this.textoDocente = d.nombre;
    this.salaSeleccionada = 0;
    this.vista = 'horario';
    this.construirGrillas();
  }

  alEscribirDocente(texto: string): void {
    this.textoDocente = texto;
    if (this.docenteActual && this.docenteActual.nombre !== texto) {
      this.docenteSeleccionado = 0;
      this.construirGrillas();
    }
  }

  quitarDocente(): void {
    this.docenteSeleccionado = 0;
    this.textoDocente = '';
    this.construirGrillas();
  }

  // Carrera y Plan no aplican en las vistas por sala, por docente o de salas libres
  // La vista por sala, por docente y de salas libres son de un solo semestre del año
  get vistasDeUnSemestreBloqueadas(): boolean {
    return this.todosLosSemestres;
  }

  get filtrosDePlanBloqueados(): boolean {
    return !!this.salaActual || !!this.docenteActual || this.vista === 'salas';
  }

  // ---------- CAL-F01: salas libres por bloque ----------

  // Para cada bloque y día: salas libres y ocupadas. Considera todas las clases del semestre
  // (todas las carreras, planes y niveles), porque una sala la puede ocupar cualquiera
  get ocupacionSalas(): { bloque: BloqueGrillaDTO; dias: CeldaOcupacion[] }[] {
    const acts = this.propuesta?.actividades ?? [];
    return this.bloquesGrilla.map((bloque) => ({
      bloque,
      dias: this.DIAS_OPCIONES.map(({ id }) => {
        const celda: CeldaOcupacion = { id_dia: id, salas: [], libres: 0 };
        for (const s of this.salas) {
          const aqui = acts.filter(
            (a) =>
              a.id_sala === s.id_sala &&
              a.id_dia === id &&
              bloque.numero >= a.bloque_inicio &&
              bloque.numero <= a.bloque_fin,
          );
          celda.salas.push({
            id_sala: s.id_sala,
            nombre: s.nombre,
            libre: !aqui.length,
            detalle: aqui
              .map((a) => `${a.codigo} ${a.nombre} (Gr. ${a.grupo} · ${a.codigo_carrera ?? ''} Sem. ${a.nivel})`)
              .join('; '),
          });
          if (!aqui.length) celda.libres++;
        }
        return celda;
      }),
    }));
  }

  // Abre el horario de una sala (CAL-F02) desde la vista de salas libres
  abrirSala(id_sala: number): void {
    this.vista = 'horario';
    this.verSala(id_sala);
  }

  cambiarVista(): void {
    this.construirGrillas();
  }

  // Uso de la sala en la propuesta del semestre (ej. "34 bloques" o "sin clases")
  usoSala(id_sala: number): string {
    const bloques = this.clasesEnSala(id_sala)
      .reduce((t, a) => t + a.bloque_fin - a.bloque_inicio + 1, 0);
    if (!bloques) return 'sin clases';
    return `${bloques} bloque${bloques === 1 ? '' : 's'}`;
  }

  get todosLosSemestres(): boolean {
    return this.semestreSeleccionado === 'TODOS';
  }

  // Propuesta del semestre del año al que pertenece un nivel (impar: 1er semestre, par: 2do)
  private propuestaDe(nivel: number): PropuestaDTO | null {
    const periodo = nivel % 2 === 0 ? 2 : 1;
    if (periodo === this.periodo) return this.propuesta;
    return this.todosLosSemestres ? this.propuestaOtra : null;
  }

  private editableNivel(nivel: number): boolean {
    const p = this.propuestaDe(nivel);
    return !!p?.generado_en && p.estado !== 'CERRADO' && !this.guardando;
  }

  // Se puede mover una clase si la propuesta de su semestre está generada y en borrador
  editableDe(a: ActividadDTO): boolean {
    return this.editableNivel(a.nivel);
  }

  // Clases de la propuesta (propias y externas) del plan elegido; con "Todos", de ambos semestres
  private get actividadesPlan(): ActividadDTO[] {
    const todas = [
      ...(this.propuesta?.actividades ?? []),
      ...(this.todosLosSemestres ? (this.propuestaOtra?.actividades ?? []) : []),
    ];
    return todas.filter((a) => a.id_plan === this.idPlanSeleccionado);
  }

  // Niveles que se muestran: el elegido, o los pares o impares que tiene el plan
  get nivelesVisibles(): number[] {
    const s = this.semestreSeleccionado;
    if (typeof s === 'number') return [s];
    const niveles = new Set<number>([
      ...this.asignaturasPlan.map((a) => a.semestre),
      ...this.actividadesPlan.map((a) => a.nivel),
    ]);
    const resto = s === 'PARES' ? 0 : 1;
    return [...niveles]
      .filter((n) => s === 'TODOS' || n % 2 === resto)
      .sort((a, b) => a - b);
  }

  get asignaturas(): AsignaturaDTO[] {
    const niveles = this.nivelesVisibles;
    return this.asignaturasPlan.filter((a) => niveles.includes(a.semestre));
  }

  get asignaturasPropias(): AsignaturaDTO[] {
    return this.asignaturas.filter(
      (a) => a.origen === 'PROPIA' || a.origen === 'INTERNA',
    );
  }

  // ---------- Resumen de la propuesta (GEN-F01, F03, F04) ----------

  get crucesSala(): CruceSalaDTO[] {
    return this.propuesta?.validacion.cruces_sala ?? [];
  }

  get crucesDocente(): CruceDocenteDTO[] {
    return this.propuesta?.validacion.cruces_docente ?? [];
  }

  // Clases que quedaron dentro de un bloque protegido (por ejemplo, si se movió el protegido)
  get crucesProtegido(): CruceProtegidoDTO[] {
    return this.propuesta?.validacion.cruces_protegido ?? [];
  }

  get totalCruces(): number {
    return this.crucesSala.length + this.crucesDocente.length + this.crucesProtegido.length;
  }

  get puedeCerrar(): boolean {
    return !!this.propuesta?.validacion.puede_cerrar;
  }

  get motivoNoCerrar(): string {
    if (!this.generada) return 'Primero genera la propuesta';
    const pendientes = [
      this.crucesSala.length && `${this.crucesSala.length} cruce(s) de sala`,
      this.crucesDocente.length && `${this.crucesDocente.length} cruce(s) de docente`,
      this.crucesProtegido.length &&
        `${this.crucesProtegido.length} clase(s) en bloque protegido`,
    ].filter(Boolean);
    return pendientes.length ? `Hay ${pendientes.join(' y ')} sin resolver` : '';
  }

  // Las asignaturas sin carga docente van aparte para no tapar el resto
  get noAsignadas(): NoAsignadaDTO[] {
    return (this.propuesta?.no_asignadas ?? []).filter((n) => n.motivo !== 'SIN_CARGA');
  }

  get sinCarga(): NoAsignadaDTO[] {
    return (this.propuesta?.no_asignadas ?? []).filter((n) => n.motivo === 'SIN_CARGA');
  }

  get totalPropias(): number {
    return new Set(
      (this.propuesta?.actividades ?? [])
        .filter((a) => a.origen === 'INTERNA')
        .map((a) => a.id_curso),
    ).size;
  }

  // ---------- Carga de datos ----------

  cargarCarreras(): void {
    this.cargando = true;
    this.horarioApi.getCarreras().subscribe({
      next: (carreras) => {
        this.carreras = carreras;
        if (carreras.length > 0) {
          const pref = carreras.find((c) => c.codigo === '311') || carreras[0];
          this.idCarreraSeleccionada = pref.codigo || pref.id_carrera;
          this.onCarreraChange();
        }
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      },
    });
  }

  onCarreraChange(): void {
    const carrera = this.carreraSeleccionada;
    this.planesDisponibles = carrera ? carrera.planes : [];

    if (this.planesDisponibles.length > 0) {
      const plan2025 =
        this.planesDisponibles.find(
          (p) =>
            p.year === 2025 || p.anio === 2025 || p.nombre.includes('2025'),
        ) || this.planesDisponibles[0];
      this.idPlanSeleccionado = plan2025.id_plan;
      this.cargarHorarioNivel();
    } else {
      this.idPlanSeleccionado = null;
      this.asignaturasPlan = [];
      this.protegidosPorNivel = {};
      this.grillas = [];
    }
  }

  onPlanOSemestreChange(): void {
    // Con "Todos los semestres" no aplican la vista por sala, por docente ni la de salas libres
    if (this.todosLosSemestres) {
      this.salaSeleccionada = 0;
      this.docenteSeleccionado = 0;
      this.textoDocente = '';
      this.vista = 'horario';
    }
    this.cargarHorarioNivel();
  }

  // La sala no cambia el semestre: solo se vuelven a armar las grillas. Elegir sala quita el docente
  onSalaChange(): void {
    if (this.salaSeleccionada) {
      this.docenteSeleccionado = 0;
      this.textoDocente = '';
    }
    this.construirGrillas();
  }

  cargarHorarioNivel(): void {
    if (!this.idPlanSeleccionado) return;

    this.cargando = true;
    const codCarrera = this.carreraSeleccionada?.codigo;

    forkJoin({
      asignaturas: this.horarioApi.getAsignaturas({ id_plan: this.idPlanSeleccionado }),
      propuesta: this.propuestaApi
        .obtener(this.YEAR, this.periodo)
        .pipe(catchError(() => of(null))),
      // Con "Todos los semestres" también se carga la propuesta del otro semestre del año
      otra: this.todosLosSemestres
        ? this.propuestaApi.obtener(this.YEAR, 3 - this.periodo).pipe(catchError(() => of(null)))
        : of(null),
    })
      .pipe(
        switchMap(({ asignaturas, propuesta, otra }) => {
          this.asignaturasPlan = asignaturas;
          this.propuesta = propuesta;
          this.propuestaOtra = otra;
          if (
            this.salaSeleccionada !== 0 &&
            !this.salas.some((s) => s.id_sala === this.salaSeleccionada)
          ) {
            this.salaSeleccionada = 0;
          }
          if (this.docenteSeleccionado && !this.docenteActual) {
            this.docenteSeleccionado = 0;
            this.textoDocente = '';
          }
          // Bloques protegidos que aplican a cada nivel visible
          const niveles = this.nivelesVisibles;
          if (!niveles.length) return of([] as [number, BloqueProtegidoDTO[]][]);
          return forkJoin(
            niveles.map((n) =>
              this.horarioApi
                .getBloquesProtegidosAplicables({ codigo_carrera: codCarrera, semestre: n })
                .pipe(
                  catchError(() => of([] as BloqueProtegidoDTO[])),
                  map((bp) => [n, bp] as [number, BloqueProtegidoDTO[]]),
                ),
            ),
          );
        }),
      )
      .subscribe({
        next: (porNivel) => {
          this.protegidosPorNivel = Object.fromEntries(porNivel);
          this.construirGrillas();
          this.cargando = false;
        },
        error: () => {
          this.cargando = false;
        },
      });
  }

  // Recarga solo la propuesta (después de mover, deshacer, generar o cerrar), sin parpadeo
  private recargarPropuesta(): void {
    forkJoin({
      propuesta: this.propuestaApi.obtener(this.YEAR, this.periodo),
      otra: this.todosLosSemestres
        ? this.propuestaApi.obtener(this.YEAR, 3 - this.periodo).pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe({
      next: ({ propuesta, otra }) => {
        this.propuesta = propuesta;
        this.propuestaOtra = otra;
        this.construirGrillas();
      },
    });
  }

  get carreraSeleccionada(): CarreraDTO | undefined {
    return this.carreras.find(
      (c) =>
        c.codigo === this.idCarreraSeleccionada ||
        String(c.id_carrera) === String(this.idCarreraSeleccionada),
    );
  }

  get planSeleccionado(): PlanDTO | undefined {
    return this.planesDisponibles.find(
      (p) => p.id_plan === this.idPlanSeleccionado,
    );
  }

  // Asignatura propia que ya tiene horario en la propuesta
  tieneHorario(a: AsignaturaDTO): boolean {
    return this.actividadesPlan.some(
      (x) => x.origen === 'INTERNA' && x.codigo === a.codigo && x.nivel === a.semestre,
    );
  }

  // ---------- Grillas ----------

  private construirGrillas(): void {
    const sala = this.salaActual;
    const docente = this.docenteActual;
    if (docente) {
      this.grillas = [
        {
          clave: `docente-${docente.id_usuario}`,
          titulo: `${docente.nombre} · ${this.etiquetaSemestre} · ${this.nombrePeriodo}`,
          subtitulo: 'Todas sus clases, con sala y bloque, de todas las carreras y planes',
          editable: this.editable,
          celdas: this.celdasDe(this.clasesDeDocente(docente.id_usuario), [], 'docente'),
        },
      ];
    } else if (sala) {
      const acts = this.clasesEnSala(sala.id_sala);
      this.grillas = [
        {
          clave: `sala-${sala.id_sala}`,
          titulo: `${sala.nombre} · ${this.etiquetaSemestre} · ${this.nombrePeriodo}`,
          subtitulo: 'Todas las clases de la sala, de todas las carreras y planes',
          editable: this.editable,
          celdas: this.celdasDe(acts, [], 'sala'),
        },
      ];
    } else {
      const carrera = this.carreraSeleccionada?.nombre ?? '';
      const plan = this.planSeleccionado?.nombre ?? '';
      this.grillas = this.nivelesVisibles.map((n) => ({
        clave: `nivel-${n}`,
        editable: this.editableNivel(n),
        titulo: `${carrera} · Semestre ${n}`,
        subtitulo: plan,
        celdas: this.celdasDe(
          this.actividadesPlan.filter((a) => a.nivel === n),
          this.protegidosPorNivel[n] ?? [],
          'nivel',
        ),
      }));
    }

    // Mantiene marcada la selección si la clase sigue en la propuesta
    const ids = new Set(this.seleccion.map((a) => a.id));
    this.seleccion = [
      ...(this.propuesta?.actividades ?? []),
      ...(this.todosLosSemestres ? (this.propuestaOtra?.actividades ?? []) : []),
    ].filter((a) => ids.has(a.id));
    this.marcarSeleccion();
  }

  // Cruces de sala o docente en los que participa una actividad, en un bloque
  private cruceDe(a: ActividadDTO, bloque: number): string | null {
    const v = this.propuestaDe(a.nivel)?.validacion ?? this.propuesta?.validacion;
    if (!v) return null;
    const toca = (c: { id_dia: number; bloque_inicio: number; bloque_fin: number; actividades: { id: string }[] }) =>
      c.id_dia === a.id_dia &&
      bloque >= c.bloque_inicio &&
      bloque <= c.bloque_fin &&
      c.actividades.some((x) => x.id === a.id);
    const sala = v.cruces_sala.find(toca);
    if (sala) return `Cruce de sala: ${sala.mensaje}`;
    const docente = v.cruces_docente.find(toca);
    if (docente) return `Cruce de docente: ${docente.mensaje}`;
    const protegido = (v.cruces_protegido ?? []).find(toca);
    if (protegido) return `En bloque protegido: «${protegido.protegido}»`;
    return null;
  }

  // Código con su grupo (ej. 123H · Gr. A): así se distinguen las clases de cada grupo
  codigoConGrupo(a: ActividadDTO): string {
    return `${a.codigo} · Gr. ${a.grupo}`;
  }

  // Grupos distintos de una misma asignatura son estudiantes distintos: no chocan entre sí
  private chocanEnNivel(acts: ActividadDTO[]): boolean {
    if (acts.length < 2) return false;
    const mismaAsignatura = acts.every((a) => a.codigo === acts[0].codigo);
    const gruposDistintos = new Set(acts.map((a) => a.grupo)).size === acts.length;
    return !(mismaAsignatura && gruposDistintos);
  }

  private celdasDe(
    actividades: ActividadDTO[],
    protegidos: BloqueProtegidoDTO[],
    modo: ModoGrilla,
  ): CeldaGrilla[] {
    // Bloques protegidos desglosados bloque a bloque
    type SlotProtegido = { dia: DiaSemana; bloque: number; nombre: string; detalle: string };
    const protegidosSlots: SlotProtegido[] = [];
    for (const bp of protegidos) {
      const bloquesList =
        bp.bloques && bp.bloques.length > 0
          ? bp.bloques
          : Array.from(
              { length: bp.bloque_fin - bp.bloque_inicio + 1 },
              (_, idx) => bp.bloque_inicio + idx,
            );
      for (const bNum of bloquesList) {
        protegidosSlots.push({
          dia: bp.dia,
          bloque: bNum,
          nombre: bp.nombre,
          detalle: formatoAlcanceLegible(bp),
        });
      }
    }

    type Slot = {
      bloque: number;
      acts: ActividadDTO[];
      protegido?: SlotProtegido;
      cruce: string | null;
      firma: string;
    };

    const celdas: CeldaGrilla[] = [];
    for (const dia of DIAS) {
      const slots: Slot[] = [];
      for (let b = 1; b <= 12; b++) {
        const acts = actividades.filter(
          (a) => a.id_dia === idDia(dia) && b >= a.bloque_inicio && b <= a.bloque_fin,
        );
        const protegido = protegidosSlots.find((p) => p.dia === dia && p.bloque === b);
        if (!acts.length && !protegido) continue;
        // Dos clases a la vez: en la vista por sala es un cruce de sala; por docente, un cruce
        // de docente; por nivel, un cruce para los estudiantes
        const cruce =
          acts.length > 1 && (modo !== 'nivel' || this.chocanEnNivel(acts))
            ? modo === 'sala'
              ? `Cruce de sala: ${acts.map((a) => `${this.codigoConGrupo(a)} (sem. ${a.nivel})`).join(' y ')} en la misma sala`
              : modo === 'docente'
                ? `Cruce de docente: ${acts.map((a) => this.codigoConGrupo(a)).join(' y ')} a la misma hora`
                : `Cruce de nivel: ${acts.map((a) => this.codigoConGrupo(a)).join(' y ')} a la misma hora`
            : acts
                .map((a) => this.cruceDe(a, b))
                // Si la celda ya muestra el bloque protegido, no se repite el aviso
                .find((x) => !!x && !(protegido && x.startsWith('En bloque protegido'))) ?? null;
        slots.push({
          bloque: b,
          acts,
          protegido,
          cruce,
          firma: [acts.map((a) => a.id).join(','), protegido?.nombre ?? '', cruce ?? ''].join('|'),
        });
      }

      // Bloques seguidos con el mismo contenido forman una celda (sin cruzar la colación)
      let i = 0;
      while (i < slots.length) {
        const s = slots[i];
        let fin = s.bloque;
        let j = i + 1;
        while (
          j < slots.length &&
          slots[j].bloque === fin + 1 &&
          (s.bloque <= 6) === (slots[j].bloque <= 6) &&
          slots[j].firma === s.firma
        ) {
          fin = slots[j].bloque;
          j++;
        }
        celdas.push(this.celdaDe(dia, s.bloque, fin, s.acts, s.protegido, s.cruce, modo));
        i = j;
      }
    }
    return celdas;
  }

  private celdaDe(
    dia: DiaSemana,
    inicio: number,
    fin: number,
    acts: ActividadDTO[],
    protegido: { nombre: string; detalle: string } | undefined,
    cruce: string | null,
    modo: ModoGrilla,
  ): CeldaGrilla {
    const base = { dia, bloque_inicio: inicio, bloque_fin: fin, ref: acts };
    if (!acts.length && protegido) {
      return { ...base, tipo: 'PROTEGIDO', etiqueta: protegido.nombre, detalle: protegido.detalle };
    }
    const a = acts[0];
    const externa = acts.every((x) => x.origen === 'EXTERNA');
    return {
      ...base,
      tipo: externa ? 'CLASE_EXTERNA' : 'CLASE_PROPIA',
      etiqueta: acts.map((x) => x.nombre).join(' / '),
      codigo: acts.map((x) => this.codigoConGrupo(x)).join(' / '),
      // En la vista por sala la sala es la misma; por sala y por docente se indica carrera y nivel
      sala:
        modo === 'sala'
          ? undefined
          : acts.map((x) => x.sala ?? x.sala_externa ?? 'Sin sala').join(' / '),
      nivel:
        modo !== 'nivel'
          ? acts.map((x) => `${x.codigo_carrera ?? ''} · Sem. ${x.nivel}`.trim()).join(' / ')
          : undefined,
      bloqueado: externa,
      advertencia_choque: !!protegido,
      bloque_protegido_nombre: protegido?.nombre,
      bloque_protegido_alcance: protegido?.detalle,
      // Con dos clases en la misma celda se mueven desde el panel, no arrastrando
      arrastrable: acts.length === 1 && !!a,
      cruce: cruce ?? undefined,
    };
  }

  private marcarSeleccion(): void {
    const ids = new Set(this.seleccion.map((a) => a.id));
    for (const g of this.grillas) {
      for (const c of g.celdas) {
        c.seleccionada = ((c.ref as ActividadDTO[]) ?? []).some((a) => ids.has(a.id));
      }
    }
  }

  // ---------- GEN-F01 / GEN-F03: generar, cerrar y reabrir ----------

  // Botón "Generar horario": abre la tarjeta de la propuesta con la confirmación
  abrirGenerar(): void {
    this.mostrarPropuesta = true;
    this.confirmandoGeneracion = !this.cerrado;
  }

  cancelarGenerar(): void {
    this.confirmandoGeneracion = false;
    this.mostrarPropuesta = false;
  }

  // Con "Todos los semestres" se elige en la tarjeta qué semestre del año se gestiona
  cambiarPeriodoTodos(): void {
    this.recargarPropuesta();
    this.confirmandoGeneracion = !this.cerrado;
  }

  generar(): void {
    this.confirmandoGeneracion = false;
    this.generando = true;
    this.propuestaApi.generar(this.YEAR, this.periodo).subscribe({
      next: (r) => {
        this.generando = false;
        this.avisar(
          `${r.mensaje}: ${r.resumen.cursos_completos} de ${r.resumen.cursos} cursos completos, ${r.resumen.no_asignadas} con pendientes`,
        );
        this.recargarPropuesta();
      },
      error: (err: HttpErrorResponse) => {
        this.generando = false;
        this.avisar(err.error?.message || 'No se pudo generar la propuesta');
      },
    });
  }

  cerrar(): void {
    if (!confirm('Al cerrar el horario ya no se podrá modificar. ¿Cerrar el horario?')) {
      return;
    }
    this.propuestaApi.cerrar(this.YEAR, this.periodo).subscribe({
      next: (r) => {
        this.avisar(r.mensaje);
        // Al cerrar el horario, la tarjeta de la propuesta se oculta
        this.mostrarPropuesta = false;
        this.recargarPropuesta();
      },
      error: (err: HttpErrorResponse) => {
        this.avisar(err.error?.message || 'No se pudo cerrar el horario');
        this.recargarPropuesta();
      },
    });
  }

  reabrir(): void {
    this.propuestaApi.reabrir(this.YEAR, this.periodo).subscribe({
      next: (r) => {
        this.avisar(r.mensaje);
        this.recargarPropuesta();
      },
      error: (err: HttpErrorResponse) =>
        this.avisar(err.error?.message || 'No se pudo reabrir el horario'),
    });
  }

  // Lleva la grilla a la sala del cruce
  irACruceSala(c: CruceSalaDTO): void {
    this.verSala(c.id_sala);
  }

  // Lleva la grilla a la sala de la primera clase del cruce que esté en una sala del departamento
  irACruceDocente(c: CruceDocenteDTO | CruceProtegidoDTO): void {
    const ids = new Set(c.actividades.map((x) => x.id));
    const conSala = (this.propuesta?.actividades ?? []).find(
      (a) => ids.has(a.id) && a.id_sala != null,
    );
    if (conSala?.id_sala != null) {
      this.verSala(conSala.id_sala);
    } else {
      this.avisar('Las clases de este cruce están en salas de otros departamentos');
    }
  }

  private verSala(id_sala: number): void {
    this.salaSeleccionada = id_sala;
    this.docenteSeleccionado = 0;
    this.textoDocente = '';
    this.construirGrillas();
    setTimeout(() =>
      document.querySelector('.grilla-main-card')?.scrollIntoView({ behavior: 'smooth' }),
    );
  }

  // ---------- GEN-F02: mover clases ----------

  // Arrastre: la clase se suelta en otro día y bloque; conserva su sala
  onMover(m: MovimientoCelda): void {
    const acts = (m.celda.ref as ActividadDTO[]) ?? [];
    if (acts.length !== 1 || !this.editableDe(acts[0])) return;
    const a = acts[0];
    // Si se tomó la clase desde un bloque intermedio, se respeta ese desplazamiento
    const desplazamiento = m.celda.bloque_inicio - a.bloque_inicio;
    this.moverActividad(a, idDia(m.dia), m.bloque_inicio - desplazamiento, a.id_sala);
  }

  // Clic en una celda de clase: se abre el panel para moverla (también a otra sala)
  onCeldaClick(c: CeldaGrilla): void {
    const acts = (c.ref as ActividadDTO[]) ?? [];
    if (!acts.length) return;
    this.seleccion = acts;
    this.destinos = {};
    for (const a of acts) {
      this.destinos[a.id] = { id_dia: a.id_dia, bloque: a.bloque_inicio, id_sala: a.id_sala };
    }
    this.marcarSeleccion();
  }

  cerrarSeleccion(): void {
    this.seleccion = [];
    this.marcarSeleccion();
  }

  moverDesdePanel(a: ActividadDTO): void {
    const d = this.destinos[a.id];
    if (!d) return;
    this.moverActividad(a, d.id_dia, d.bloque, d.id_sala);
  }

  private moverActividad(
    a: ActividadDTO,
    hacia_dia: number,
    hacia_bloque: number,
    hacia_sala: number | null,
  ): void {
    const largo = a.bloque_fin - a.bloque_inicio + 1;
    const fin = hacia_bloque + largo - 1;
    if (hacia_bloque < 1 || fin > 12 || (hacia_bloque <= 6 && fin >= 7)) {
      this.avisar(
        `La clase dura ${largo} bloque(s): no cabe ahí sin cruzar la colación o pasar del bloque 12`,
      );
      return;
    }
    if (
      hacia_dia === a.id_dia &&
      hacia_bloque === a.bloque_inicio &&
      hacia_sala === a.id_sala
    ) {
      return;
    }

    this.guardando = true;
    this.propuestaApi
      .mover({
        year: this.YEAR,
        periodo: a.nivel % 2 === 0 ? 2 : 1,
        origen: a.origen,
        id_curso: a.id_curso,
        id_dia: a.id_dia,
        bloque_inicio: a.bloque_inicio,
        bloque_fin: a.bloque_fin,
        id_sala: a.id_sala,
        hacia_dia,
        hacia_bloque,
        hacia_sala: hacia_sala ?? undefined,
      })
      .subscribe({
        next: (r) => {
          this.guardando = false;
          this.seleccion = [];
          this.avisar(`${a.codigo} movida. ${this.resumenValidacion(r.validacion)}`);
          this.recargarPropuesta();
        },
        error: (err: HttpErrorResponse) => {
          this.guardando = false;
          this.avisar(err.error?.message || 'No se pudo mover la clase');
          this.recargarPropuesta();
        },
      });
  }

  deshacer(): void {
    this.guardando = true;
    this.propuestaApi.deshacer(this.YEAR, this.periodo).subscribe({
      next: (r) => {
        this.guardando = false;
        this.avisar(`${r.mensaje}. ${this.resumenValidacion(r.validacion)}`);
        this.recargarPropuesta();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando = false;
        this.avisar(err.error?.message || 'No se pudo deshacer');
      },
    });
  }

  private resumenValidacion(v: ValidacionDTO): string {
    const protegidos = v.cruces_protegido?.length ?? 0;
    const n = v.cruces_sala.length + v.cruces_docente.length + protegidos;
    if (n === 0) return 'Horario revalidado: sin cruces.';
    const extra = protegidos ? `, ${protegidos} en bloque protegido` : '';
    return `Horario revalidado: ${v.cruces_sala.length} cruce(s) de sala y ${v.cruces_docente.length} de docente${extra}.`;
  }

  private avisar(mensaje: string): void {
    this.snack.open(mensaje, 'Cerrar', { duration: 6000 });
  }
}
