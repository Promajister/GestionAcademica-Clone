import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ActividadDTO,
  CruceDocenteDTO,
  CruceSalaDTO,
  MotivoNoAsignada,
  NoAsignadaDTO,
  PropuestaApiService,
  PropuestaDTO,
} from '../../services/propuesta-api.service';
import { HorarioApiService, BloqueGrillaDTO } from '../../services/horario-api.service';

// Vista de la grilla: una sala del departamento o las clases que usan salas de otros departamentos
type Vista = number | 'EXTERNAS';

const MOTIVOS: Record<MotivoNoAsignada, string> = {
  SIN_CARGA: 'Sin carga docente',
  SIN_BLOQUES: 'Sin horas semanales',
  SIN_SALA: 'Sin sala disponible',
  SIN_DISPONIBILIDAD: 'Sin disponibilidad del docente',
  SIN_BLOQUE_LIBRE: 'Sin bloque libre',
};

@Component({
  standalone: true,
  selector: 'app-horario-propuesta',
  templateUrl: './horario-propuesta.component.html',
  styleUrls: ['./horario-propuesta.component.scss'],
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
  ],
})
export class HorarioPropuestaComponent implements OnInit {
  private api = inject(PropuestaApiService);
  private horarioApi = inject(HorarioApiService);
  private snack = inject(MatSnackBar);

  readonly DIAS = [
    { id: 1, label: 'Lunes' },
    { id: 2, label: 'Martes' },
    { id: 3, label: 'Miércoles' },
    { id: 4, label: 'Jueves' },
    { id: 5, label: 'Viernes' },
  ];
  readonly YEARS = [2026, 2027];
  readonly MOTIVOS = MOTIVOS;

  year = 2026;
  periodo = 2;
  vista: Vista = 1;

  grilla: BloqueGrillaDTO[] = [];
  propuesta: PropuestaDTO | null = null;
  cargando = false;
  generando = false;
  verSinCarga = false;

  ngOnInit(): void {
    this.horarioApi.getGrilla().subscribe({
      next: (bloques) => (this.grilla = bloques),
    });
    this.cargar();
  }

  get bloquesManana(): BloqueGrillaDTO[] {
    return this.grilla.filter((b) => b.numero <= 6);
  }

  get bloquesTarde(): BloqueGrillaDTO[] {
    return this.grilla.filter((b) => b.numero >= 7);
  }

  get cerrado(): boolean {
    return this.propuesta?.estado === 'CERRADO';
  }

  get generada(): boolean {
    return !!this.propuesta?.generado_en;
  }

  get salasClases() {
    return (this.propuesta?.salas ?? []).filter((s) => s.tipo === 'CLASES');
  }

  get salasReuniones() {
    return (this.propuesta?.salas ?? []).filter((s) => s.tipo === 'REUNIONES');
  }

  get nombreVista(): string {
    if (this.vista === 'EXTERNAS') return 'Salas de otros departamentos';
    return this.propuesta?.salas.find((s) => s.id_sala === this.vista)?.nombre ?? '';
  }

  // Asignaturas no ubicadas: las que no tienen carga docente van aparte para no tapar el resto
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

  cargar(): void {
    this.cargando = true;
    this.api.obtener(this.year, this.periodo).subscribe({
      next: (p) => {
        this.propuesta = p;
        this.cargando = false;
      },
      error: (err: HttpErrorResponse) => {
        this.cargando = false;
        this.avisar(err.error?.message || 'No se pudo cargar la propuesta');
      },
    });
  }

  generar(): void {
    if (
      this.generada &&
      !confirm(
        'Se reemplazarán las clases propias de la propuesta actual, incluidos los cambios hechos a mano. ¿Continuar?',
      )
    ) {
      return;
    }
    this.generando = true;
    this.api.generar(this.year, this.periodo).subscribe({
      next: (r) => {
        this.generando = false;
        this.avisar(
          `${r.mensaje}: ${r.resumen.cursos_completos} de ${r.resumen.cursos} cursos completos, ${r.resumen.no_asignadas} con pendientes`,
        );
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.generando = false;
        this.avisar(err.error?.message || 'No se pudo generar la propuesta');
      },
    });
  }

  // ---------- GEN-F03: cruces y cierre ----------
  get crucesSala(): CruceSalaDTO[] {
    return this.propuesta?.validacion.cruces_sala ?? [];
  }

  get puedeCerrar(): boolean {
    return !!this.propuesta?.validacion.puede_cerrar;
  }

  get crucesDocente(): CruceDocenteDTO[] {
    return this.propuesta?.validacion.cruces_docente ?? [];
  }

  get motivoNoCerrar(): string {
    if (!this.generada) return 'Primero genera la propuesta';
    const pendientes = [
      this.crucesSala.length && `${this.crucesSala.length} cruce(s) de sala`,
      this.crucesDocente.length && `${this.crucesDocente.length} cruce(s) de docente`,
    ].filter(Boolean);
    return pendientes.length ? `Hay ${pendientes.join(' y ')} sin resolver` : '';
  }

  // GEN-F04: actividad con un docente que está en otra clase al mismo tiempo
  cruceDocenteDe(a: ActividadDTO, bloque: number): CruceDocenteDTO | undefined {
    return this.crucesDocente.find(
      (c) =>
        c.id_dia === a.id_dia &&
        bloque >= c.bloque_inicio &&
        bloque <= c.bloque_fin &&
        c.actividades.some((x) => x.id === a.id),
    );
  }

  // Lleva la grilla a la sala de la primera actividad del cruce
  irACruceDocente(c: CruceDocenteDTO): void {
    const primera = this.propuesta?.actividades.find((a) =>
      c.actividades.some((x) => x.id === a.id),
    );
    if (primera) this.vista = primera.id_sala ?? 'EXTERNAS';
  }

  // Actividad marcada en un cruce de sala en este bloque
  enCruceSala(a: ActividadDTO, bloque: number): boolean {
    return this.crucesSala.some(
      (c) =>
        c.id_dia === a.id_dia &&
        bloque >= c.bloque_inicio &&
        bloque <= c.bloque_fin &&
        c.actividades.some((x) => x.id === a.id),
    );
  }

  celdaConCruce(id_dia: number, bloque: number): boolean {
    return (
      this.vista !== 'EXTERNAS' &&
      this.crucesSala.some(
        (c) =>
          c.id_sala === this.vista &&
          c.id_dia === id_dia &&
          bloque >= c.bloque_inicio &&
          bloque <= c.bloque_fin,
      )
    );
  }

  irACruce(c: CruceSalaDTO): void {
    this.vista = c.id_sala;
  }

  cerrar(): void {
    if (!confirm('Al cerrar el horario ya no se podrá modificar. ¿Cerrar el horario?')) {
      return;
    }
    this.api.cerrar(this.year, this.periodo).subscribe({
      next: (r) => {
        this.avisar(r.mensaje);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.avisar(err.error?.message || 'No se pudo cerrar el horario');
        this.cargar();
      },
    });
  }

  reabrir(): void {
    this.api.reabrir(this.year, this.periodo).subscribe({
      next: (r) => {
        this.avisar(r.mensaje);
        this.cargar();
      },
      error: (err: HttpErrorResponse) =>
        this.avisar(err.error?.message || 'No se pudo reabrir el horario'),
    });
  }

  // Actividades que ocupan este día y bloque en la vista elegida
  actividadesEn(id_dia: number, bloque: number): ActividadDTO[] {
    return (this.propuesta?.actividades ?? []).filter(
      (a) =>
        a.id_dia === id_dia &&
        bloque >= a.bloque_inicio &&
        bloque <= a.bloque_fin &&
        (this.vista === 'EXTERNAS' ? a.id_sala == null : a.id_sala === this.vista),
    );
  }

  contarEnSala(id_sala: number | null): number {
    return (this.propuesta?.actividades ?? []).filter((a) => a.id_sala === id_sala)
      .length;
  }

  crucesEnSala(id_sala: number): number {
    return this.crucesSala.filter((c) => c.id_sala === id_sala).length;
  }

  docentes(a: ActividadDTO): string {
    return a.docentes.map((d) => d.nombre).join(', ');
  }

  tooltip(a: ActividadDTO): string {
    const lugar = a.sala ?? a.sala_externa ?? 'Sin sala';
    const quien = a.origen === 'EXTERNA' ? 'Asignatura externa (bloque fijo)' : this.docentes(a);
    return `${a.codigo} ${a.nombre} · Grupo ${a.grupo} · Nivel ${a.nivel}\n${a.dia} B${a.bloque_inicio}–B${a.bloque_fin} · ${lugar}\n${quien}`;
  }

  private avisar(mensaje: string): void {
    this.snack.open(mensaje, 'Cerrar', { duration: 6000 });
  }
}
