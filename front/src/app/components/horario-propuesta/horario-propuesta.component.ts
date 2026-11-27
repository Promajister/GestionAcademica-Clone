import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  HorarioApiService,
  AsignaturaDTO,
  BloqueProtegidoDTO,
  CarreraDTO,
  CursoPropuestaDTO,
  DiaSemana,
  PlanDTO,
  PropuestaHorarioDTO,
  SesionPropuestaDTO,
  TIPO_CURSO_LABEL,
  MOTIVO_NO_ASIGNADO_LABEL,
  ADVERTENCIA_LABEL,
} from '../../services/horario-api.service';
import {
  HorarioGrillaComponent,
  CeldaGrilla,
} from '../horario-grilla/horario-grilla.component';
import { formatoAlcanceLegible } from '../horario-grilla/horario-grilla-page.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../gestion/confirm-dialog.component';

const DIAS: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];

const DIA_CORTO: Record<DiaSemana, string> = {
  LUNES: 'Lun',
  MARTES: 'Mar',
  MIERCOLES: 'Mié',
  JUEVES: 'Jue',
  VIERNES: 'Vie',
};

interface GrupoAsignatura {
  codigo: string;
  nombre: string;
  nivel: number;
  cursos: CursoPropuestaDTO[];
}

// Slot de un bloque individual antes de fusionar consecutivos
type Slot = Omit<CeldaGrilla, 'bloque_inicio' | 'bloque_fin'> & {
  bloque: number;
  grupoKey: string;
};

@Component({
  standalone: true,
  selector: 'app-horario-propuesta',
  templateUrl: './horario-propuesta.component.html',
  styleUrls: [
    '../horario-grilla/horario-grilla-page.component.scss',
    './horario-propuesta.component.scss',
  ],
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    HorarioGrillaComponent,
  ],
})
export class HorarioPropuestaComponent implements OnInit {
  private horarioApi = inject(HorarioApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  readonly PERIODOS = [
    { valor: 1, nombre: 'Primer semestre' },
    { valor: 2, nombre: 'Segundo semestre' },
  ];
  readonly TIPO_CURSO_LABEL = TIPO_CURSO_LABEL;
  readonly MOTIVO_LABEL = MOTIVO_NO_ASIGNADO_LABEL;
  readonly ADVERTENCIA_LABEL = ADVERTENCIA_LABEL;

  // ---------- selección ----------
  carreras: CarreraDTO[] = [];
  planesDisponibles: PlanDTO[] = [];
  idCarreraSeleccionada: string | null = null;
  idPlanSeleccionado: number | null = null;
  periodoSeleccionado: 1 | 2 = 1;

  // Nivel que se ve en la grilla (pestaña) y filtro de las listas
  nivelSeleccionado: number | null = null;
  filtroNivelListas: number | 'TODOS' = 'TODOS';

  // ---------- estado de carga ----------
  cargandoPropuesta = false;
  cargandoNivel = false;
  procesando: 'generar' | 'guardar' | 'descartar' | null = null;

  // ---------- datos ----------
  propuesta: PropuestaHorarioDTO | null = null;
  // Contexto fijo del nivel seleccionado (no lo modifica la generación)
  asignaturasNivel: AsignaturaDTO[] = [];
  protegidosNivel: BloqueProtegidoDTO[] = [];
  celdas: CeldaGrilla[] = [];
  verAsignaturasSinCursos = false;

  ngOnInit(): void {
    // Desde la Grilla Semanal llegan carrera, plan y semestre (nivel)
    const qp = this.route.snapshot.queryParamMap;
    const carrera = qp.get('carrera');
    const plan = Number(qp.get('plan'));
    const nivel = Number(qp.get('semestre'));
    if (nivel > 0) {
      this.periodoSeleccionado = nivel % 2 === 1 ? 1 : 2;
      this.nivelSeleccionado = nivel;
    }

    this.horarioApi.getCarreras().subscribe({
      next: (carreras) => {
        this.carreras = carreras;
        const pref =
          carreras.find((c) => c.codigo === carrera) ??
          carreras.find((c) => c.codigo === '311') ??
          carreras[0];
        if (!pref) return;
        this.idCarreraSeleccionada = pref.codigo;
        this.planesDisponibles = pref.planes ?? [];
        this.idPlanSeleccionado =
          this.planesDisponibles.find((p) => p.id_plan === plan)?.id_plan ??
          this.planesDisponibles[0]?.id_plan ??
          null;
        this.cargarPropuesta();
      },
      error: () =>
        this.snack.open('No se pudieron cargar las carreras', 'Cerrar', { duration: 4000 }),
    });
  }

  // ---------- getters ----------
  get carreraSeleccionada(): CarreraDTO | undefined {
    return this.carreras.find((c) => c.codigo === this.idCarreraSeleccionada);
  }

  get planSeleccionado(): PlanDTO | undefined {
    return this.planesDisponibles.find((p) => p.id_plan === this.idPlanSeleccionado);
  }

  get nombrePeriodo(): string {
    return this.PERIODOS.find((p) => p.valor === this.periodoSeleccionado)?.nombre ?? '';
  }

  get ocupado(): boolean {
    return this.cargandoPropuesta || this.procesando !== null;
  }

  get puedeOperar(): boolean {
    return !!this.idPlanSeleccionado && !this.ocupado;
  }

  get esBorrador(): boolean {
    return this.propuesta?.estado === 'BORRADOR';
  }

  get niveles(): number[] {
    return this.propuesta?.niveles ?? [];
  }

  private get payload() {
    return { id_plan: this.idPlanSeleccionado as number, periodo: this.periodoSeleccionado };
  }

  // Cursos de las listas, según el filtro de nivel
  get cursosFiltrados(): CursoPropuestaDTO[] {
    const cursos = this.propuesta?.cursos ?? [];
    return this.filtroNivelListas === 'TODOS'
      ? cursos
      : cursos.filter((c) => c.nivel === this.filtroNivelListas);
  }

  get cursosPendientes(): CursoPropuestaDTO[] {
    return this.cursosFiltrados.filter((c) => c.estado !== 'ASIGNADO');
  }

  get gruposAsignados(): GrupoAsignatura[] {
    const grupos = new Map<string, GrupoAsignatura>();
    for (const c of this.cursosFiltrados.filter((x) => x.sesiones.length > 0)) {
      const k = `${c.nivel}-${c.codigo_asignatura}`;
      if (!grupos.has(k)) {
        grupos.set(k, {
          codigo: c.codigo_asignatura,
          nombre: c.nombre_asignatura,
          nivel: c.nivel,
          cursos: [],
        });
      }
      grupos.get(k)!.cursos.push(c);
    }
    return [...grupos.values()];
  }

  cursosDelNivel(nivel: number): number {
    return (this.propuesta?.cursos ?? []).filter((c) => c.nivel === nivel).length;
  }

  // ---------- cambios de selección ----------
  onCarreraChange(): void {
    this.planesDisponibles = this.carreraSeleccionada?.planes ?? [];
    this.idPlanSeleccionado = this.planesDisponibles[0]?.id_plan ?? null;
    this.nivelSeleccionado = null;
    this.cargarPropuesta();
  }

  onPlanOPeriodoChange(): void {
    this.nivelSeleccionado = null;
    this.cargarPropuesta();
  }

  seleccionarNivel(nivel: number): void {
    if (this.nivelSeleccionado === nivel) return;
    this.nivelSeleccionado = nivel;
    this.cargarNivel();
  }

  // ---------- carga ----------
  // Trae el borrador (o la propuesta guardada) del plan y período
  cargarPropuesta(): void {
    if (!this.idPlanSeleccionado) {
      this.aplicarPropuesta(null);
      return;
    }
    this.cargandoPropuesta = true;
    this.horarioApi.getPropuesta(this.payload).subscribe({
      next: (p) => {
        this.cargandoPropuesta = false;
        this.aplicarPropuesta(p);
      },
      error: (err) => {
        this.cargandoPropuesta = false;
        this.aplicarPropuesta(null);
        this.mostrarError(err, 'No se pudo cargar la propuesta');
      },
    });
  }

  // Externas y bloques protegidos del nivel que se ve en la grilla
  private cargarNivel(): void {
    const nivel = this.nivelSeleccionado;
    if (!this.idPlanSeleccionado || !nivel) {
      this.asignaturasNivel = [];
      this.protegidosNivel = [];
      this.construirCeldas();
      return;
    }
    this.cargandoNivel = true;
    forkJoin({
      asignaturas: this.horarioApi
        .getAsignaturas({ id_plan: this.idPlanSeleccionado, semestre: nivel })
        .pipe(catchError(() => of([] as AsignaturaDTO[]))),
      protegidos: this.horarioApi
        .getBloquesProtegidosAplicables({
          codigo_carrera: this.idCarreraSeleccionada ?? undefined,
          semestre: nivel,
        })
        .pipe(catchError(() => of([] as BloqueProtegidoDTO[]))),
    }).subscribe(({ asignaturas, protegidos }) => {
      // Puede haber cambiado de nivel mientras cargaba
      if (nivel !== this.nivelSeleccionado) return;
      this.cargandoNivel = false;
      this.asignaturasNivel = asignaturas;
      this.protegidosNivel = protegidos;
      this.construirCeldas();
    });
  }

  private aplicarPropuesta(p: PropuestaHorarioDTO | null): void {
    this.propuesta = p;
    this.verAsignaturasSinCursos = false;
    const niveles = p?.niveles ?? [];
    if (!this.nivelSeleccionado || !niveles.includes(this.nivelSeleccionado)) {
      this.nivelSeleccionado = niveles[0] ?? null;
    }
    if (this.filtroNivelListas !== 'TODOS' && !niveles.includes(this.filtroNivelListas)) {
      this.filtroNivelListas = 'TODOS';
    }
    this.cargarNivel();
  }

  // ---------- acciones ----------
  confirmarGenerar(): void {
    if (!this.propuesta?.estado) {
      this.generar();
      return;
    }
    this.confirmar(
      {
        title: this.esBorrador ? 'Regenerar propuesta' : 'Generar nueva propuesta',
        message: `Se generará una nueva propuesta para el ${this.nombrePeriodo.toLowerCase()}.`,
        detail: this.esBorrador
          ? 'El borrador actual (sin guardar) se reemplaza. La propuesta guardada no cambia hasta que guardes.'
          : 'Quedará como borrador; la propuesta guardada no cambia hasta que guardes.',
        confirmText: 'Generar',
        cancelText: 'Cancelar',
        tone: 'primary',
      },
      () => this.generar(),
    );
  }

  private generar(): void {
    this.ejecutar('generar', this.horarioApi.generarPropuesta(this.payload), (p) => {
      const r = p.resumen;
      this.snack.open(
        `Propuesta generada: ${r.asignados} de ${r.total_cursos} cursos asignados`,
        'Cerrar',
        { duration: 4000 },
      );
    });
  }

  confirmarGuardar(): void {
    const r = this.propuesta?.resumen;
    if (!r) return;
    const avisos: string[] = [];
    if (r.no_asignados + r.parciales > 0)
      avisos.push(`${r.no_asignados + r.parciales} curso(s) quedan sin horario completo.`);
    if (r.sin_docente > 0) avisos.push(`${r.sin_docente} curso(s) no tienen docente asignado.`);
    this.confirmar(
      {
        title: 'Guardar propuesta',
        message: `Se guardará la propuesta del ${this.nombrePeriodo.toLowerCase()} (${r.asignados + r.parciales} de ${r.total_cursos} cursos con horario).`,
        detail: [...avisos, 'Reemplaza la propuesta guardada anteriormente para este plan y período.'].join(' '),
        confirmText: 'Guardar',
        cancelText: 'Cancelar',
        tone: 'primary',
      },
      () =>
        this.ejecutar('guardar', this.horarioApi.guardarPropuesta(this.payload), () =>
          this.snack.open('Propuesta guardada', 'Cerrar', { duration: 3000 }),
        ),
    );
  }

  confirmarDescartar(): void {
    this.confirmar(
      {
        title: 'Descartar borrador',
        message: '¿Descartar el borrador generado?',
        detail: 'La propuesta guardada, si existe, no se elimina.',
        confirmText: 'Descartar',
        cancelText: 'Cancelar',
        tone: 'danger',
      },
      () =>
        this.ejecutar('descartar', this.horarioApi.descartarBorrador(this.payload), () =>
          this.snack.open('Borrador descartado', 'Cerrar', { duration: 3000 }),
        ),
    );
  }

  volverAGrilla(): void {
    this.router.navigate(['/horario/grilla']);
  }

  private confirmar(data: ConfirmDialogData, accion: () => void): void {
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) accion();
      });
  }

  // Todas las acciones devuelven la propuesta actualizada
  private ejecutar(
    accion: 'generar' | 'guardar' | 'descartar',
    peticion$: Observable<PropuestaHorarioDTO>,
    alTerminar: (p: PropuestaHorarioDTO) => void,
  ): void {
    if (!this.puedeOperar) return;
    this.procesando = accion;
    peticion$.subscribe({
      next: (p) => {
        this.procesando = null;
        this.aplicarPropuesta(p);
        alTerminar(p);
      },
      error: (err) => {
        this.procesando = null;
        this.mostrarError(err, 'No se pudo completar la acción');
      },
    });
  }

  private mostrarError(err: any, porDefecto: string): void {
    const msg = err?.error?.message;
    this.snack.open(Array.isArray(msg) ? msg.join('. ') : msg || porDefecto, 'Cerrar', {
      duration: 5000,
    });
  }

  // ---------- presentación ----------
  bloquesAsignados(c: CursoPropuestaDTO): number {
    return c.sesiones.reduce((acc, s) => acc + (s.bloque_fin - s.bloque_inicio + 1), 0);
  }

  formatoSesion(s: SesionPropuestaDTO): string {
    const bloques =
      s.bloque_inicio === s.bloque_fin
        ? `B${s.bloque_inicio}`
        : `B${s.bloque_inicio}–B${s.bloque_fin}`;
    return `${DIA_CORTO[s.dia]} ${bloques}`;
  }

  nombresDocentes(c: CursoPropuestaDTO): string {
    return c.docentes.map((d) => d.nombre).join(', ');
  }

  tooltipAdvertencia(a: string): string {
    return a === 'SIN_DOCENTE'
      ? 'Se programó como si el docente estuviera siempre disponible'
      : 'No se validó la capacidad de la sala';
  }

  // Grilla del nivel seleccionado: protegidos + externas (fijas) + cursos propuestos
  private construirCeldas(): void {
    const slots = new Map<string, Slot>();
    const key = (dia: DiaSemana, b: number) => `${dia}-${b}`;

    // 1. Bloques protegidos
    for (const bp of this.protegidosNivel) {
      const bloques =
        bp.bloques && bp.bloques.length > 0
          ? bp.bloques
          : Array.from(
              { length: bp.bloque_fin - bp.bloque_inicio + 1 },
              (_, i) => bp.bloque_inicio + i,
            );
      for (const b of bloques) {
        slots.set(key(bp.dia, b), {
          dia: bp.dia,
          bloque: b,
          tipo: 'PROTEGIDO',
          etiqueta: bp.nombre,
          detalle: formatoAlcanceLegible(bp),
          grupoKey: `PR-${bp.nombre}-${bp.alcance}`,
        });
      }
    }

    // Una clase sobre un protegido conserva el aviso de choque
    const ponerClase = (slot: Slot) => {
      const k = key(slot.dia, slot.bloque);
      const previo = slots.get(k);
      if (previo?.tipo === 'PROTEGIDO') {
        slot.advertencia_choque = true;
        slot.bloque_protegido_nombre = previo.etiqueta;
      }
      slots.set(k, slot);
    };

    // 2. Asignaturas externas: se muestran tal cual, nunca se modifican
    for (const a of this.asignaturasNivel.filter((x) => x.origen === 'EXTERNA')) {
      for (const c of a.cursos ?? []) {
        for (const bh of c.bloques_horarios ?? []) {
          const sala = bh.sala?.nombre || bh.sala_externa || 'Sin sala';
          ponerClase({
            dia: bh.dia,
            bloque: bh.bloque_numero,
            tipo: 'CLASE_EXTERNA',
            etiqueta: a.nombre,
            codigo: a.codigo,
            sala,
            bloqueado: bh.bloqueado,
            grupoKey: `EX-${a.codigo}-${c.id_curso}-${sala}`,
          });
        }
      }
    }

    // 3. Cursos propuestos del nivel
    (this.propuesta?.cursos ?? [])
      .filter((c) => c.nivel === this.nivelSeleccionado)
      .forEach((c) => {
        c.sesiones.forEach((s, si) => {
          for (let b = s.bloque_inicio; b <= s.bloque_fin; b++) {
            ponerClase({
              dia: s.dia,
              bloque: b,
              tipo: 'PROPUESTA',
              etiqueta: `${TIPO_CURSO_LABEL[c.tipo]} · ${c.nombre_asignatura}`,
              codigo: c.grupo ? `${c.codigo_asignatura}-${c.grupo}` : c.codigo_asignatura,
              sala: s.sala_nombre,
              docente: c.docentes.length ? this.nombresDocentes(c) : undefined,
              sin_docente: c.advertencias.includes('SIN_DOCENTE'),
              grupoKey: `PP-${c.id_curso}-${si}`,
            });
          }
        });
      });

    // 4. Fusionar bloques consecutivos del mismo elemento (sin cruzar la colación)
    const mismaJornada = (b1: number, b2: number) => (b1 <= 6) === (b2 <= 6);
    const resultado: CeldaGrilla[] = [];

    for (const dia of DIAS) {
      const delDia = [...slots.values()]
        .filter((s) => s.dia === dia)
        .sort((a, b) => a.bloque - b.bloque);

      let i = 0;
      while (i < delDia.length) {
        const actual = delDia[i];
        let fin = actual.bloque;
        let j = i + 1;
        while (
          j < delDia.length &&
          delDia[j].bloque === fin + 1 &&
          mismaJornada(actual.bloque, delDia[j].bloque) &&
          delDia[j].grupoKey === actual.grupoKey &&
          !!delDia[j].advertencia_choque === !!actual.advertencia_choque
        ) {
          fin = delDia[j].bloque;
          j++;
        }
        const { bloque, grupoKey, ...resto } = actual;
        resultado.push({ ...resto, bloque_inicio: bloque, bloque_fin: fin });
        i = j;
      }
    }

    this.celdas = resultado;
  }
}
