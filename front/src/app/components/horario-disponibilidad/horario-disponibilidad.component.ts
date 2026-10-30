import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  HorarioApiService,
  BloqueDisponibleDTO,
  DiaSemana,
  MiDisponibilidadDTO,
} from '../../services/horario-api.service';
import {
  HorarioGrillaComponent,
  CeldaGrilla,
} from '../horario-grilla/horario-grilla.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../gestion/confirm-dialog.component';

const TOTAL_BLOQUES = 12;

const clave = (dia: DiaSemana, bloque: number) => `${dia}-${bloque}`;

// DIS-F02-T3 · "Mi disponibilidad": el docente por horas marca sobre la grilla
// semanal los bloques en que puede hacer clases y los guarda al confirmar.
@Component({
  standalone: true,
  selector: 'app-horario-disponibilidad',
  templateUrl: './horario-disponibilidad.component.html',
  styleUrls: [
    '../horario-grilla/horario-grilla-page.component.scss',
    './horario-disponibilidad.component.scss',
  ],
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    HorarioGrillaComponent,
  ],
})
export class HorarioDisponibilidadComponent implements OnInit {
  private horarioApi = inject(HorarioApiService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  cargando = false;
  guardando = false;
  error: string | null = null;

  datos: MiDisponibilidadDTO | null = null;

  // Estado guardado en BD vs. estado que el docente está editando
  private guardado = new Set<string>();
  seleccion = new Set<string>();

  celdas: CeldaGrilla[] = [];

  ngOnInit(): void {
    this.cargar();
  }

  get habilitado(): boolean {
    return !!this.datos?.habilitado;
  }

  get hayCambios(): boolean {
    if (this.guardado.size !== this.seleccion.size) return true;
    for (const k of this.seleccion) if (!this.guardado.has(k)) return true;
    return false;
  }

  get totalBloques(): number {
    return this.seleccion.size;
  }

  get horasSemanales(): string {
    // 45 min por bloque pedagógico
    const horas = (this.seleccion.size * 45) / 60;
    return horas.toLocaleString('es-CL', { maximumFractionDigits: 2 });
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.horarioApi.getMiDisponibilidad().subscribe({
      next: (res) => {
        this.aplicarRespuesta(res);
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.datos = null;
        this.error =
          err?.error?.message || 'No se pudo cargar tu disponibilidad';
      },
    });
  }

  onSeleccionar(ev: { dia: DiaSemana; bloque: number }): void {
    if (!this.habilitado || this.guardando) return;
    const k = clave(ev.dia, ev.bloque);
    if (this.seleccion.has(k)) this.seleccion.delete(k);
    else this.seleccion.add(k);
    this.construirCeldas();
  }

  marcarDia(dia: DiaSemana): void {
    if (!this.habilitado) return;
    const claves = Array.from({ length: TOTAL_BLOQUES }, (_, i) => clave(dia, i + 1));
    const todosMarcados = claves.every((k) => this.seleccion.has(k));
    for (const k of claves) {
      if (todosMarcados) this.seleccion.delete(k);
      else this.seleccion.add(k);
    }
    this.construirCeldas();
  }

  limpiar(): void {
    this.seleccion.clear();
    this.construirCeldas();
  }

  descartar(): void {
    this.seleccion = new Set(this.guardado);
    this.construirCeldas();
  }

  confirmarGuardar(): void {
    if (!this.hayCambios || this.guardando) return;

    const data: ConfirmDialogData = {
      title: 'Confirmar disponibilidad',
      message: `Vas a guardar ${this.totalBloques} bloque(s) disponibles (${this.horasSemanales} h semanales).`,
      detail: 'Esta disponibilidad reemplaza la que tenías registrada.',
      confirmText: 'Guardar',
      cancelText: 'Cancelar',
      tone: 'primary',
    };

    this.dialog
      .open(ConfirmDialogComponent, { data, width: '420px' })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) this.guardar();
      });
  }

  private guardar(): void {
    const bloques: BloqueDisponibleDTO[] = [...this.seleccion].map((k) => {
      const [dia, bloque] = k.split('-');
      return { dia: dia as DiaSemana, bloque: Number(bloque) };
    });

    this.guardando = true;
    this.horarioApi.guardarMiDisponibilidad(bloques).subscribe({
      next: (res) => {
        this.aplicarRespuesta(res);
        this.guardando = false;
        this.snack.open('Disponibilidad guardada', 'Cerrar', { duration: 3000 });
      },
      error: (err) => {
        this.guardando = false;
        this.snack.open(
          err?.error?.message || 'No se pudo guardar la disponibilidad',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  // Avisar si cierra/recarga la pestaña con cambios sin guardar
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.hayCambios) {
      e.preventDefault();
      e.returnValue = '';
    }
  }

  private aplicarRespuesta(res: MiDisponibilidadDTO): void {
    this.datos = res;
    this.guardado = new Set((res.bloques ?? []).map((b) => clave(b.dia, b.bloque)));
    this.seleccion = new Set(this.guardado);
    this.construirCeldas();
  }

  // Cada bloque disponible es su propia celda, para poder desmarcarlo de a uno
  private construirCeldas(): void {
    this.celdas = [...this.seleccion].map((k) => {
      const [dia, bloque] = k.split('-');
      return {
        dia: dia as DiaSemana,
        bloque_inicio: Number(bloque),
        bloque_fin: Number(bloque),
        tipo: 'DISPONIBLE' as const,
        etiqueta: 'Disponible',
      };
    });
  }

  readonly DIAS_LABEL: { dia: DiaSemana; label: string }[] = [
    { dia: 'LUNES', label: 'Lun' },
    { dia: 'MARTES', label: 'Mar' },
    { dia: 'MIERCOLES', label: 'Mié' },
    { dia: 'JUEVES', label: 'Jue' },
    { dia: 'VIERNES', label: 'Vie' },
  ];
}
