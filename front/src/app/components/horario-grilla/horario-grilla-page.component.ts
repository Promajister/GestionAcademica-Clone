import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
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
import { HorarioGrillaComponent, CeldaGrilla } from './horario-grilla.component';

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
    HorarioGrillaComponent,
  ],
})
export class HorarioGrillaPageComponent implements OnInit {
  private horarioApi = inject(HorarioApiService);

  carreras: CarreraDTO[] = [];
  planesDisponibles: PlanDTO[] = [];

  idCarreraSeleccionada: string | number | null = null;
  idPlanSeleccionado: number | null = null;
  semestreSeleccionado = 2; // Default a 2 para la demo

  readonly SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  cargando = false;
  asignaturas: AsignaturaDTO[] = [];
  bloquesProtegidos: BloqueProtegidoDTO[] = [];
  celdasGrilla: CeldaGrilla[] = [];

  ngOnInit(): void {
    this.cargarCarreras();
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
    }).subscribe({
      next: ({ asignaturas, protegidos }) => {
        this.asignaturas = asignaturas;
        this.bloquesProtegidos = protegidos;
        this.construirCeldasGrilla(asignaturas, protegidos);
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
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

  private construirCeldasGrilla(
    asignaturas: AsignaturaDTO[],
    protegidos: BloqueProtegidoDTO[],
  ): void {
    const dias: DiaSemana[] = [
      'LUNES',
      'MARTES',
      'MIERCOLES',
      'JUEVES',
      'VIERNES',
    ];

    // 1. Extraer bloques de cursos desglosados celda a celda (dia, bloque)
    type SlotCurso = {
      dia: DiaSemana;
      bloque: number;
      asignaturaNombre: string;
      codigo: string;
      sala: string;
      bloqueado: boolean;
      origen: string;
    };
    const cursosSlots: SlotCurso[] = [];

    for (const asig of asignaturas) {
      for (const curso of asig.cursos || []) {
        for (const bh of curso.bloques_horarios || []) {
          const salaNombre =
            bh.sala?.nombre || bh.sala_externa || 'Sin sala';
          cursosSlots.push({
            dia: bh.dia,
            bloque: bh.bloque_numero,
            asignaturaNombre: asig.nombre,
            codigo: asig.codigo,
            sala: salaNombre,
            bloqueado: bh.bloqueado,
            origen: asig.origen,
          });
        }
      }
    }

    // 2. Extraer bloques protegidos desglosados celda a celda
    type SlotProtegido = {
      dia: DiaSemana;
      bloque: number;
      nombre: string;
      detalle: string;
    };
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

    // 3. Evaluar cada slot y fusionar consecutivos
    const celdasResultado: CeldaGrilla[] = [];

    for (const dia of dias) {
      type SlotDef = {
        dia: DiaSemana;
        bloque: number;
        tipo: 'CLASE_EXTERNA' | 'CLASE_PROPIA' | 'PROTEGIDO';
        etiqueta: string;
        codigo?: string;
        sala?: string;
        detalle?: string;
        bloqueado?: boolean;
        advertencia_choque?: boolean;
        bloque_protegido_nombre?: string;
        bloque_protegido_alcance?: string;
      };

      const slotsDia: SlotDef[] = [];

      for (let b = 1; b <= 12; b++) {
        const c = cursosSlots.find((cs) => cs.dia === dia && cs.bloque === b);
        const p = protegidosSlots.find((ps) => ps.dia === dia && ps.bloque === b);

        if (c && p) {
          // Ambos coinciden: se muestran ambos
          slotsDia.push({
            dia,
            bloque: b,
            tipo: c.origen === 'EXTERNA' ? 'CLASE_EXTERNA' : 'CLASE_PROPIA',
            etiqueta: c.asignaturaNombre,
            codigo: c.codigo,
            sala: c.sala,
            bloqueado: c.bloqueado,
            advertencia_choque: true,
            bloque_protegido_nombre: p.nombre,
            bloque_protegido_alcance: p.detalle,
          });
        } else if (c) {
          slotsDia.push({
            dia,
            bloque: b,
            tipo: c.origen === 'EXTERNA' ? 'CLASE_EXTERNA' : 'CLASE_PROPIA',
            etiqueta: c.asignaturaNombre,
            codigo: c.codigo,
            sala: c.sala,
            bloqueado: c.bloqueado,
          });
        } else if (p) {
          slotsDia.push({
            dia,
            bloque: b,
            tipo: 'PROTEGIDO',
            etiqueta: p.nombre,
            detalle: p.detalle,
          });
        }
      }

      // Agrupar consecutivos compatibles del día (sin cruzar colación entre 6 y 7)
      let i = 0;
      while (i < slotsDia.length) {
        const actual = slotsDia[i];
        let fin = actual.bloque;
        let j = i + 1;

        const mismaJornadaSlots = (b1: number, b2: number) =>
          (b1 <= 6 && b2 <= 6) || (b1 >= 7 && b2 >= 7);

        while (
          j < slotsDia.length &&
          slotsDia[j].bloque === fin + 1 &&
          mismaJornadaSlots(actual.bloque, slotsDia[j].bloque) &&
          slotsDia[j].tipo === actual.tipo &&
          slotsDia[j].etiqueta === actual.etiqueta &&
          slotsDia[j].codigo === actual.codigo &&
          slotsDia[j].sala === actual.sala &&
          slotsDia[j].advertencia_choque === actual.advertencia_choque &&
          slotsDia[j].bloque_protegido_nombre === actual.bloque_protegido_nombre
        ) {
          fin = slotsDia[j].bloque;
          j++;
        }

        celdasResultado.push({
          dia,
          bloque_inicio: actual.bloque,
          bloque_fin: fin,
          tipo: actual.tipo,
          etiqueta: actual.etiqueta,
          codigo: actual.codigo,
          sala: actual.sala,
          detalle: actual.detalle,
          bloqueado: actual.bloqueado,
          advertencia_choque: actual.advertencia_choque,
          bloque_protegido_nombre: actual.bloque_protegido_nombre,
          bloque_protegido_alcance: actual.bloque_protegido_alcance,
        });

        i = j;
      }
    }

    this.celdasGrilla = celdasResultado;
  }
}
