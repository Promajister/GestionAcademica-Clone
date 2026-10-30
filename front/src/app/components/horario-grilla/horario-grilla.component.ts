import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  HorarioApiService,
  BloqueGrillaDTO,
  DiaSemana,
} from '../../services/horario-api.service';

export type TipoCeldaGrilla =
  | 'CLASE_PROPIA'
  | 'CLASE_EXTERNA'
  | 'PROTEGIDO'
  | 'DISPONIBLE';

export interface CeldaGrilla {
  dia: DiaSemana;
  bloque_inicio: number;
  bloque_fin: number;
  tipo: TipoCeldaGrilla;
  etiqueta: string;
  codigo?: string;
  sala?: string;
  detalle?: string;
  bloqueado?: boolean;
  advertencia_choque?: boolean;
  bloque_protegido_nombre?: string;
  bloque_protegido_alcance?: string;
}

@Component({
  standalone: true,
  selector: 'app-horario-grilla',
  templateUrl: './horario-grilla.component.html',
  styleUrls: ['./horario-grilla.component.scss'],
  imports: [CommonModule, MatIconModule, MatTooltipModule],
})
export class HorarioGrillaComponent implements OnInit {
  private horarioApi = inject(HorarioApiService);

  @Input() celdas: CeldaGrilla[] = [];
  @Input() titulo = '';
  @Input() subtitulo = '';
  @Input() modo: 'lectura' | 'seleccion' = 'lectura';

  @Output() seleccionar = new EventEmitter<{ dia: DiaSemana; bloque: number }>();

  grilla: BloqueGrillaDTO[] = [];
  cargandoGrilla = false;

  readonly DIAS: { dia: DiaSemana; label: string }[] = [
    { dia: 'LUNES', label: 'Lunes' },
    { dia: 'MARTES', label: 'Martes' },
    { dia: 'MIERCOLES', label: 'Miércoles' },
    { dia: 'JUEVES', label: 'Jueves' },
    { dia: 'VIERNES', label: 'Viernes' },
  ];

  ngOnInit(): void {
    this.cargandoGrilla = true;
    this.horarioApi.getGrilla().subscribe({
      next: (bloques) => {
        this.grilla = bloques;
        this.cargandoGrilla = false;
      },
      error: () => {
        // Fallback estándar en caso de desconexión
        this.grilla = this.fallbackGrilla();
        this.cargandoGrilla = false;
      },
    });
  }

  get bloquesManana(): BloqueGrillaDTO[] {
    return this.grilla.filter((b) => b.numero <= 6);
  }

  get bloquesTarde(): BloqueGrillaDTO[] {
    return this.grilla.filter((b) => b.numero >= 7);
  }

  // Encuentra la celda que INICIA en este día y bloque
  celdaQueInicia(dia: DiaSemana, bloqueNum: number): CeldaGrilla | undefined {
    return this.celdas.find(
      (c) => c.dia === dia && c.bloque_inicio === bloqueNum,
    );
  }

  // Indica si este día y bloque está cubierto por un bloque que inició antes (para no pintar <td>)
  estaCubierto(dia: DiaSemana, bloqueNum: number): boolean {
    return this.celdas.some(
      (c) =>
        c.dia === dia && bloqueNum > c.bloque_inicio && bloqueNum <= c.bloque_fin,
    );
  }

  calcularRowspan(c: CeldaGrilla): number {
    return Math.max(1, c.bloque_fin - c.bloque_inicio + 1);
  }

  onCeldaClick(dia: DiaSemana, bloqueNum: number): void {
    if (this.modo === 'seleccion') {
      this.seleccionar.emit({ dia, bloque: bloqueNum });
    }
  }

  private fallbackGrilla(): BloqueGrillaDTO[] {
    return [
      { numero: 1, hora_inicio: '08:00', hora_fin: '08:45', jornada: 'MANANA' },
      { numero: 2, hora_inicio: '08:45', hora_fin: '09:30', jornada: 'MANANA' },
      { numero: 3, hora_inicio: '09:40', hora_fin: '10:25', jornada: 'MANANA' },
      { numero: 4, hora_inicio: '10:25', hora_fin: '11:10', jornada: 'MANANA' },
      { numero: 5, hora_inicio: '11:20', hora_fin: '12:05', jornada: 'MANANA' },
      { numero: 6, hora_inicio: '12:05', hora_fin: '12:50', jornada: 'MANANA' },
      { numero: 7, hora_inicio: '14:45', hora_fin: '15:30', jornada: 'TARDE' },
      { numero: 8, hora_inicio: '15:30', hora_fin: '16:15', jornada: 'TARDE' },
      { numero: 9, hora_inicio: '16:20', hora_fin: '17:05', jornada: 'TARDE' },
      { numero: 10, hora_inicio: '17:05', hora_fin: '17:50', jornada: 'TARDE' },
      { numero: 11, hora_inicio: '17:55', hora_fin: '18:40', jornada: 'TARDE' },
      { numero: 12, hora_inicio: '18:40', hora_fin: '19:25', jornada: 'TARDE' },
    ];
  }
}
