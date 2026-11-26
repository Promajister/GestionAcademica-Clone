import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  HorarioCalendarioService,
  OcupacionCelda,
  DocenteCalendarioDTO,
} from '../../services/horario-calendario.service';

@Component({
  selector: 'app-horario-calendario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './horario-calendario.component.html',
  styleUrl: './horario-calendario.component.css',
})
export class HorarioCalendarioComponent implements OnInit {
  salas: any[] = [];
  dias: any[] = [];
  bloques: any[] = [];
  docentes: DocenteCalendarioDTO[] = [];
  estadoHorario: string = 'SIN_GENERAR';

  ocupacionesMap = new Map<string, OcupacionCelda>();

  semestreActual = 2;
  yearActual = 2026;
  soloResaltarLibres = false;
  cargando = false;

  // Filtro CAL-F02 (Por Sala)
  salaSeleccionadaId: number | null = null;

  // Filtro CAL-F03 (Selección única de Docente)
  textoBusquedaDocente = '';
  docenteSeleccionado: DocenteCalendarioDTO | null = null;

  constructor(private calendarioService: HorarioCalendarioService) {}

  ngOnInit(): void {
    this.cargarOcupacion();
  }

  cargarOcupacion(): void {
    this.cargando = true;
    this.calendarioService
      .obtenerOcupacionSemanal(this.semestreActual, this.yearActual)
      .subscribe({
        next: (res) => {
          this.salas = res.salas;
          this.dias = res.dias;
          this.bloques = res.bloques;
          this.docentes = res.docentes || [];
          this.estadoHorario = res.estado_horario;

          this.ocupacionesMap.clear();
          for (const oc of res.ocupaciones) {
            this.ocupacionesMap.set(`${oc.id_dia}-${oc.id_bloque}-${oc.id_sala}`, oc);
          }
          this.cargando = false;
        },
        error: () => {
          this.cargando = false;
        },
      });
  }

  // Filtra las opciones del desplegable mientras escribes
  get docentesFiltradosAutocomplete(): DocenteCalendarioDTO[] {
    const q = this.textoBusquedaDocente.trim().toLowerCase();
    if (!q) return this.docentes;
    return this.docentes.filter((d) => d.nombre.toLowerCase().includes(q));
  }

  seleccionarDocente(docente: DocenteCalendarioDTO): void {
    this.docenteSeleccionado = docente;
    this.textoBusquedaDocente = docente.nombre;
  }

  alEscribirDocente(valor: string): void {
    this.textoBusquedaDocente = valor;
    // Si borra el texto o cambia el nombre sin elegir una opción, desactiva el filtro
    if (!valor.trim() || this.docenteSeleccionado?.nombre !== valor) {
      this.docenteSeleccionado = null;
    }
  }

  limpiarDocente(): void {
    this.docenteSeleccionado = null;
    this.textoBusquedaDocente = '';
  }

  get salasFiltradas() {
    if (this.salaSeleccionadaId !== null) {
      return this.salas.filter((s) => s.id_sala === this.salaSeleccionadaId);
    }
    return this.salas;
  }

  getOcupacion(id_dia: number, id_bloque: number, id_sala: number): OcupacionCelda | null {
    const oc = this.ocupacionesMap.get(`${id_dia}-${id_bloque}-${id_sala}`) || null;
    if (!oc) return null;

    // Filtra ÚNICAMENTE por el docente seleccionado (ID exacto)
    if (this.docenteSeleccionado && oc.id_usuario !== this.docenteSeleccionado.id_usuario) {
      return null;
    }

    return oc;
  }

  limpiarFiltros(): void {
    this.salaSeleccionadaId = null;
    this.limpiarDocente();
    this.soloResaltarLibres = false;
  }
}