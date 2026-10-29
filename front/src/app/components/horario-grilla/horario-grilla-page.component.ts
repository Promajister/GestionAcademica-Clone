import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import {
  HorarioApiService,
  CarreraDTO,
  PlanDTO,
  AsignaturaDTO,
  DiaSemana,
} from '../../services/horario-api.service';
import { HorarioGrillaComponent, CeldaGrilla } from './horario-grilla.component';

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
          // Seleccionar carrera 311 por defecto si existe
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
      (c) => c.codigo === this.idCarreraSeleccionada || String(c.id_carrera) === String(this.idCarreraSeleccionada),
    );
    this.planesDisponibles = carrera ? carrera.planes : [];

    if (this.planesDisponibles.length > 0) {
      // Seleccionar Plan 2025 v1 por defecto si existe
      const plan2025 =
        this.planesDisponibles.find((p) => p.year === 2025 || p.anio === 2025 || p.nombre.includes('2025')) ||
        this.planesDisponibles[0];
      this.idPlanSeleccionado = plan2025.id_plan;
      this.cargarHorarioNivel();
    } else {
      this.idPlanSeleccionado = null;
      this.asignaturas = [];
      this.celdasGrilla = [];
    }
  }

  onPlanOSemestreChange(): void {
    this.cargarHorarioNivel();
  }

  cargarHorarioNivel(): void {
    if (!this.idPlanSeleccionado || !this.semestreSeleccionado) return;

    this.cargando = true;
    this.horarioApi
      .getAsignaturas({
        id_plan: this.idPlanSeleccionado,
        semestre: this.semestreSeleccionado,
      })
      .subscribe({
        next: (asignaturas) => {
          this.asignaturas = asignaturas;
          this.construirCeldasGrilla(asignaturas);
          this.cargando = false;
        },
        error: () => {
          this.cargando = false;
        },
      });
  }

  get carreraSeleccionada(): CarreraDTO | undefined {
    return this.carreras.find(
      (c) => c.codigo === this.idCarreraSeleccionada || String(c.id_carrera) === String(this.idCarreraSeleccionada),
    );
  }

  get planSeleccionado(): PlanDTO | undefined {
    return this.planesDisponibles.find((p) => p.id_plan === this.idPlanSeleccionado);
  }

  get asignaturasPropias(): AsignaturaDTO[] {
    return this.asignaturas.filter((a) => a.origen === 'PROPIA' || a.origen === 'INTERNA');
  }

  get asignaturasExternas(): AsignaturaDTO[] {
    return this.asignaturas.filter((a) => a.origen === 'EXTERNA');
  }

  private construirCeldasGrilla(asignaturas: AsignaturaDTO[]): void {
    const celdas: CeldaGrilla[] = [];

    for (const asig of asignaturas) {
      const cursos = asig.cursos || [];
      for (const curso of cursos) {
        const bloques = (curso.bloques_horarios || []).slice().sort((a, b) => {
          if (a.dia !== b.dia) return a.dia.localeCompare(b.dia);
          return a.bloque_numero - b.bloque_numero;
        });

        // Agrupar bloques consecutivos del mismo día
        let i = 0;
        while (i < bloques.length) {
          const actual = bloques[i];
          let inicio = actual.bloque_numero;
          let fin = actual.bloque_numero;
          const dia: DiaSemana = actual.dia;
          const salaNombre = actual.sala?.nombre || actual.sala_externa || 'Sin sala';

          let j = i + 1;
          while (
            j < bloques.length &&
            bloques[j].dia === dia &&
            bloques[j].bloque_numero === fin + 1 &&
            (bloques[j].sala?.nombre || bloques[j].sala_externa) ===
              (actual.sala?.nombre || actual.sala_externa)
          ) {
            fin = bloques[j].bloque_numero;
            j++;
          }

          celdas.push({
            dia,
            bloque_inicio: inicio,
            bloque_fin: fin,
            tipo: asig.origen === 'EXTERNA' ? 'CLASE_EXTERNA' : 'CLASE_PROPIA',
            etiqueta: asig.nombre,
            codigo: asig.codigo,
            sala: salaNombre,
            bloqueado: actual.bloqueado,
          });

          i = j;
        }
      }
    }

    this.celdasGrilla = celdas;
  }
}
