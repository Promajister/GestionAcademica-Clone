import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  HorarioApiService,
  CarreraDTO,
  PlanDTO,
  AsignaturaDTO,
  DiaSemana,
  BloqueProtegidoDTO,
} from '../../services/horario-api.service';
import {
  ActividadDTO,
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

@Component({
  standalone: true,
  selector: 'app-horario-grilla-page',
  templateUrl: './horario-grilla-page.component.html',
  styleUrls: ['./horario-grilla-page.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
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
  semestreSeleccionado = 2; // Default a 2 para la demo

  readonly SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly YEAR = YEAR_PROPUESTA;
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
  asignaturas: AsignaturaDTO[] = [];
  bloquesProtegidos: BloqueProtegidoDTO[] = [];
  propuesta: PropuestaDTO | null = null;
  celdasGrilla: CeldaGrilla[] = [];

  // GEN-F02: clases de la celda elegida y a dónde moverlas desde el panel
  seleccion: ActividadDTO[] = [];
  destinos: Record<string, { id_dia: number; bloque: number; id_sala: number | null }> = {};

  ngOnInit(): void {
    this.cargarCarreras();
  }

  get periodo(): number {
    return this.semestreSeleccionado % 2 === 0 ? 2 : 1;
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

  get salasClases() {
    return (this.propuesta?.salas ?? []).filter((s) => s.tipo === 'CLASES');
  }

  get totalCruces(): number {
    const v = this.propuesta?.validacion;
    return v ? v.cruces_sala.length + v.cruces_docente.length : 0;
  }

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
    const carrera = this.carreras.find(
      (c) =>
        c.codigo === this.idCarreraSeleccionada ||
        String(c.id_carrera) === String(this.idCarreraSeleccionada),
    );
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
      this.asignaturas = [];
      this.bloquesProtegidos = [];
      this.celdasGrilla = [];
    }
  }

  onPlanOSemestreChange(): void {
    this.cargarHorarioNivel();
  }

  cargarHorarioNivel(): void {
    if (!this.idPlanSeleccionado || !this.semestreSeleccionado) return;

    this.cargando = true;
    const codCarrera = this.carreraSeleccionada?.codigo;

    forkJoin({
      asignaturas: this.horarioApi.getAsignaturas({
        id_plan: this.idPlanSeleccionado,
        semestre: this.semestreSeleccionado,
      }),
      protegidos: this.horarioApi
        .getBloquesProtegidosAplicables({
          codigo_carrera: codCarrera,
          semestre: this.semestreSeleccionado,
        })
        .pipe(catchError(() => of([] as BloqueProtegidoDTO[]))),
      propuesta: this.propuestaApi
        .obtener(this.YEAR, this.periodo)
        .pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ asignaturas, protegidos, propuesta }) => {
        this.asignaturas = asignaturas;
        this.bloquesProtegidos = protegidos;
        this.propuesta = propuesta;
        this.construirCeldasGrilla();
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      },
    });
  }

  // Recarga solo la propuesta (después de mover o deshacer), sin parpadeo de la página
  private recargarPropuesta(): void {
    this.propuestaApi.obtener(this.YEAR, this.periodo).subscribe({
      next: (p) => {
        this.propuesta = p;
        this.construirCeldasGrilla();
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

  get asignaturasPropias(): AsignaturaDTO[] {
    return this.asignaturas.filter(
      (a) => a.origen === 'PROPIA' || a.origen === 'INTERNA',
    );
  }

  get asignaturasExternas(): AsignaturaDTO[] {
    return this.asignaturas.filter((a) => a.origen === 'EXTERNA');
  }

  // Clases de la propuesta (propias y externas) de la carrera, plan y nivel elegidos
  get actividadesNivel(): ActividadDTO[] {
    return (this.propuesta?.actividades ?? []).filter(
      (a) =>
        a.id_plan === this.idPlanSeleccionado &&
        a.nivel === this.semestreSeleccionado,
    );
  }

  // Asignatura propia que ya tiene horario en la propuesta
  tieneHorario(a: AsignaturaDTO): boolean {
    return this.actividadesNivel.some(
      (x) => x.origen === 'INTERNA' && x.codigo === a.codigo,
    );
  }

  // Cruces de sala o docente en los que participa una actividad, en un bloque
  private cruceDe(a: ActividadDTO, bloque: number): string | null {
    const v = this.propuesta?.validacion;
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
    return null;
  }

  private construirCeldasGrilla(): void {
    const actividades = this.actividadesNivel;

    // Bloques protegidos desglosados bloque a bloque
    type SlotProtegido = { dia: DiaSemana; bloque: number; nombre: string; detalle: string };
    const protegidosSlots: SlotProtegido[] = [];
    for (const bp of this.bloquesProtegidos) {
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
        // Dos clases del mismo nivel a la vez también es un cruce para los estudiantes
        const cruce =
          acts.length > 1
            ? `Cruce de nivel: ${acts.map((a) => a.codigo).join(' y ')} a la misma hora`
            : acts.map((a) => this.cruceDe(a, b)).find((x) => !!x) ?? null;
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
        celdas.push(this.celdaDe(dia, s.bloque, fin, s.acts, s.protegido, s.cruce));
        i = j;
      }
    }

    this.celdasGrilla = celdas;
    // Mantiene marcada la selección si la clase sigue en la grilla
    const ids = new Set(this.seleccion.map((a) => a.id));
    this.seleccion = actividades.filter((a) => ids.has(a.id));
    this.marcarSeleccion();
  }

  private celdaDe(
    dia: DiaSemana,
    inicio: number,
    fin: number,
    acts: ActividadDTO[],
    protegido: { nombre: string; detalle: string } | undefined,
    cruce: string | null,
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
      codigo: acts.map((x) => x.codigo).join(' / '),
      sala: acts.map((x) => x.sala ?? x.sala_externa ?? 'Sin sala').join(' / '),
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
    for (const c of this.celdasGrilla) {
      c.seleccionada = ((c.ref as ActividadDTO[]) ?? []).some((a) => ids.has(a.id));
    }
  }

  // ---------- GEN-F02: mover clases ----------

  // Arrastre: la clase se suelta en otro día y bloque; conserva su sala
  onMover(m: MovimientoCelda): void {
    const acts = (m.celda.ref as ActividadDTO[]) ?? [];
    if (!this.editable || acts.length !== 1) return;
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
        periodo: this.periodo,
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
    const n = v.cruces_sala.length + v.cruces_docente.length;
    if (n === 0) return 'Horario revalidado: sin cruces.';
    return `Horario revalidado: ${v.cruces_sala.length} cruce(s) de sala y ${v.cruces_docente.length} de docente.`;
  }

  private avisar(mensaje: string): void {
    this.snack.open(mensaje, 'Cerrar', { duration: 6000 });
  }
}
