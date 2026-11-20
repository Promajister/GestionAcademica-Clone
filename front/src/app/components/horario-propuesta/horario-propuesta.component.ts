import { Component, HostListener, OnInit, inject } from '@angular/core';
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
import { forkJoin, of } from 'rxjs';
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
import { SalaDTO } from '../../services/salas-api.service';
import { generarPropuestaMock } from '../../services/horario-propuesta.mock';
import {
  HorarioGrillaComponent,
  CeldaGrilla,
} from '../horario-grilla/horario-grilla.component';
import { formatoAlcanceLegible } from '../horario-grilla/horario-grilla-page.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../gestion/confirm-dialog.component';

// TODO(HOR-69): poner en false cuando exista el endpoint de generación en el back
const USAR_MOCK_SI_NO_HAY_BACK = true;

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

  readonly SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly TIPO_CURSO_LABEL = TIPO_CURSO_LABEL;
  readonly MOTIVO_LABEL = MOTIVO_NO_ASIGNADO_LABEL;
  readonly ADVERTENCIA_LABEL = ADVERTENCIA_LABEL;

  carreras: CarreraDTO[] = [];
  planesDisponibles: PlanDTO[] = [];
  idCarreraSeleccionada: string | null = null;
  idPlanSeleccionado: number | null = null;
  semestreSeleccionado: number | null = null;

  cargandoContexto = false;
  generando = false;
  procesando = false; // aceptar / descartar

  // Contexto del nivel (lo que la generación NO modifica)
  asignaturas: AsignaturaDTO[] = [];
  protegidos: BloqueProtegidoDTO[] = [];
  salas: SalaDTO[] = [];

  propuesta: PropuestaHorarioDTO | null = null;
  usandoMock = false;

  cursosPendientes: CursoPropuestaDTO[] = []; // NO_ASIGNADO + PARCIAL
  gruposAsignados: GrupoAsignatura[] = [];
  celdas: CeldaGrilla[] = [];

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const carrera = qp.get('carrera');
    const plan = Number(qp.get('plan'));
    const semestre = Number(qp.get('semestre'));

    this.cargandoContexto = true;
    this.horarioApi.getCarreras().subscribe({
      next: (carreras) => {
        this.carreras = carreras;
        const pref =
          carreras.find((c) => c.codigo === carrera) ??
          carreras.find((c) => c.codigo === '311') ??
          carreras[0];
        if (!pref) {
          this.cargandoContexto = false;
          return;
        }
        this.idCarreraSeleccionada = pref.codigo;
        this.planesDisponibles = pref.planes ?? [];
        this.idPlanSeleccionado =
          this.planesDisponibles.find((p) => p.id_plan === plan)?.id_plan ??
          this.planesDisponibles[0]?.id_plan ??
          null;
        this.semestreSeleccionado = this.SEMESTRES.includes(semestre) ? semestre : 1;
        this.cargarContexto();
      },
      error: () => {
        this.cargandoContexto = false;
        this.snack.open('No se pudieron cargar las carreras', 'Cerrar', { duration: 4000 });
      },
    });
  }

  // ---------- Selección de nivel ----------
  get carreraSeleccionada(): CarreraDTO | undefined {
    return this.carreras.find((c) => c.codigo === this.idCarreraSeleccionada);
  }

  get planSeleccionado(): PlanDTO | undefined {
    return this.planesDisponibles.find((p) => p.id_plan === this.idPlanSeleccionado);
  }

  get puedeGenerar(): boolean {
    return (
      !!this.idCarreraSeleccionada &&
      !!this.idPlanSeleccionado &&
      !!this.semestreSeleccionado &&
      !this.cargandoContexto &&
      !this.generando &&
      !this.procesando
    );
  }

  onCarreraChange(): void {
    this.planesDisponibles = this.carreraSeleccionada?.planes ?? [];
    this.idPlanSeleccionado = this.planesDisponibles[0]?.id_plan ?? null;
    this.cargarContexto();
  }

  onPlanOSemestreChange(): void {
    this.cargarContexto();
  }

  // Asignaturas externas, bloques protegidos y salas del nivel
  cargarContexto(): void {
    if (!this.idPlanSeleccionado || !this.semestreSeleccionado) {
      this.asignaturas = [];
      this.protegidos = [];
      this.construirCeldas();
      return;
    }

    this.cargandoContexto = true;
    forkJoin({
      asignaturas: this.horarioApi.getAsignaturas({
        id_plan: this.idPlanSeleccionado,
        semestre: this.semestreSeleccionado,
      }),
      protegidos: this.horarioApi
        .getBloquesProtegidosAplicables({
          codigo_carrera: this.idCarreraSeleccionada ?? undefined,
          semestre: this.semestreSeleccionado,
        })
        .pipe(catchError(() => of([] as BloqueProtegidoDTO[]))),
      salas: this.horarioApi.getSalas(true).pipe(catchError(() => of([] as SalaDTO[]))),
    }).subscribe({
      next: ({ asignaturas, protegidos, salas }) => {
        this.asignaturas = asignaturas;
        this.protegidos = protegidos;
        this.salas = salas;
        this.cargandoContexto = false;
        this.construirCeldas();
      },
      error: () => {
        this.cargandoContexto = false;
        this.snack.open('No se pudo cargar la información del nivel', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  get asignaturasPropias(): AsignaturaDTO[] {
    return this.asignaturas.filter((a) => a.origen === 'PROPIA' || a.origen === 'INTERNA');
  }

  get asignaturasExternas(): AsignaturaDTO[] {
    return this.asignaturas.filter((a) => a.origen === 'EXTERNA');
  }

  // ---------- Generar / descartar / aceptar ----------
  generar(): void {
    if (!this.puedeGenerar) return;
    const payload = {
      codigo_carrera: this.idCarreraSeleccionada as string,
      id_plan: this.idPlanSeleccionado as number,
      semestre: this.semestreSeleccionado as number,
    };

    this.generando = true;
    this.horarioApi.generarPropuesta(payload).subscribe({
      next: (p) => {
        this.generando = false;
        this.aplicarPropuesta(p, false);
      },
      error: (err) => {
        // 404 = endpoint aún no implementado, 0 = back caído
        if (USAR_MOCK_SI_NO_HAY_BACK && (err?.status === 404 || err?.status === 0)) {
          const p = generarPropuestaMock({
            ...payload,
            asignaturas: this.asignaturas,
            protegidos: this.protegidos,
            salas: this.salas,
          });
          this.generando = false;
          this.aplicarPropuesta(p, true);
          return;
        }
        this.generando = false;
        this.snack.open(
          err?.error?.message || 'No se pudo generar la propuesta',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  confirmarRegenerar(): void {
    const data: ConfirmDialogData = {
      title: 'Regenerar propuesta',
      message: 'Se generará una nueva propuesta para este nivel.',
      detail: 'La propuesta actual se reemplaza y no se guarda.',
      confirmText: 'Regenerar',
      cancelText: 'Cancelar',
      tone: 'primary',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '420px' })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) this.generar();
      });
  }

  confirmarDescartar(): void {
    const data: ConfirmDialogData = {
      title: 'Descartar propuesta',
      message: '¿Descartar la propuesta generada?',
      detail: 'El horario actual del nivel no cambia.',
      confirmText: 'Descartar',
      cancelText: 'Cancelar',
      tone: 'danger',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '420px' })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) this.descartar();
      });
  }

  private descartar(): void {
    const id = this.propuesta?.id_propuesta;
    if (this.usandoMock || id == null) {
      this.limpiarPropuesta();
      return;
    }
    this.procesando = true;
    this.horarioApi.descartarPropuesta(id).subscribe({
      next: () => {
        this.procesando = false;
        this.limpiarPropuesta();
      },
      error: (err) => {
        this.procesando = false;
        this.snack.open(
          err?.error?.message || 'No se pudo descartar la propuesta',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  confirmarAceptar(): void {
    const p = this.propuesta;
    if (!p) return;
    const r = p.resumen;

    const avisos: string[] = [];
    if (r.no_asignados + r.parciales > 0)
      avisos.push(`${r.no_asignados + r.parciales} curso(s) quedan sin horario completo.`);
    if (r.sin_docente > 0) avisos.push(`${r.sin_docente} curso(s) no tienen docente asignado.`);

    const data: ConfirmDialogData = {
      title: 'Aceptar propuesta',
      message: `Se guardará el horario de ${r.asignados + r.parciales} de ${r.total_cursos} cursos del nivel.`,
      detail: [...avisos, 'Reemplaza el horario actual de los cursos propios del nivel. Las asignaturas externas no se modifican.'].join(' '),
      confirmText: 'Aceptar y guardar',
      cancelText: 'Cancelar',
      tone: 'primary',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) this.aceptar();
      });
  }

  private aceptar(): void {
    const id = this.propuesta?.id_propuesta;
    // TODO(HOR-69): con el mock no existe borrador en el back, así que se simula
    // una respuesta exitosa (no se guarda nada). Quitar junto con el mock.
    const peticion$ =
      this.usandoMock || id == null
        ? of({ mensaje: 'Horario guardado' })
        : this.horarioApi.aceptarPropuesta(id);

    this.procesando = true;
    peticion$.subscribe({
      next: (res) => {
        this.procesando = false;
        this.propuesta = null; // evita el aviso de salida
        this.snack.open(res?.mensaje || 'Horario guardado', 'Cerrar', { duration: 4000 });
        this.volverAGrilla();
      },
      error: (err) => {
        this.procesando = false;
        this.snack.open(
          err?.error?.message || 'No se pudo guardar la propuesta',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  volverAGrilla(): void {
    this.router.navigate(['/horario/grilla']);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.propuesta) {
      e.preventDefault();
      e.returnValue = '';
    }
  }

  // ---------- Presentación ----------
  private aplicarPropuesta(p: PropuestaHorarioDTO, mock: boolean): void {
    this.propuesta = p;
    this.usandoMock = mock;

    this.cursosPendientes = p.cursos.filter((c) => c.estado !== 'ASIGNADO');

    const grupos = new Map<string, GrupoAsignatura>();
    for (const c of p.cursos.filter((x) => x.sesiones.length > 0)) {
      if (!grupos.has(c.codigo_asignatura)) {
        grupos.set(c.codigo_asignatura, {
          codigo: c.codigo_asignatura,
          nombre: c.nombre_asignatura,
          cursos: [],
        });
      }
      grupos.get(c.codigo_asignatura)!.cursos.push(c);
    }
    this.gruposAsignados = [...grupos.values()];

    this.construirCeldas();
  }

  private limpiarPropuesta(): void {
    this.propuesta = null;
    this.usandoMock = false;
    this.cursosPendientes = [];
    this.gruposAsignados = [];
    this.construirCeldas();
  }

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

  // Grilla: protegidos + externas (fijas) + cursos propuestos
  private construirCeldas(): void {
    const slots = new Map<string, Slot>();
    const key = (dia: DiaSemana, b: number) => `${dia}-${b}`;

    // 1. Bloques protegidos
    for (const bp of this.protegidos) {
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
    for (const a of this.asignaturasExternas) {
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

    // 3. Cursos propuestos
    if (this.propuesta) {
      this.propuesta.cursos.forEach((c, ci) => {
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
              grupoKey: `PP-${ci}-${si}`,
            });
          }
        });
      });
    }

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
