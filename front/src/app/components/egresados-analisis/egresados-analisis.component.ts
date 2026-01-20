import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { EncuestasEgresadosService } from '../../services/encuestas-egresados.service';

type SurveyTipo = 'EMPLEABILIDAD' | 'ACREDITACION';

interface EgresadoEncuestaRow {
  id: number;
  tipo: SurveyTipo;
  fecha?: string | Date | null;
  generales?: Record<string, any> | null;
  respuestas?: Array<{
    pregunta?: { descripcion?: string | null };
    alternativa?: { descripcion?: string | null };
    respuestaAbierta?: string | null;
  }>;
}

interface EmpleabilidadStats {
  total: number;
  totalTrabajando: number;
  pctTrabajando: number;
  countTrabajando: number;
  pctPostgrado: number;
  countPostgrado: number;
  pctCapacitacion: number;
  countCapacitacion: number;
  pctPertinenciaAlta: number;
  countPertinenciaAlta: number;
  pctEmpleoRapido: number;
  countEmpleoRapido: number;
  pctRentaAlta: number;
  countRentaAlta: number;
  pctJefatura: number;
  countJefatura: number;
  genero: {
    mujer: number;
    hombre: number;
    noResponde: number;
  };
  generoCounts: {
    mujer: number;
    hombre: number;
    noResponde: number;
  };
  trabajandoGenero: {
    mujer: number;
    hombre: number;
    noResponde: number;
  };
  trabajandoGeneroCounts: {
    mujer: number;
    hombre: number;
    noResponde: number;
  };
  sector: {
    publico: number;
    privado: number;
    otro: number;
  };
  sectorCounts: {
    publico: number;
    privado: number;
    otro: number;
  };
}

interface AcreditacionStats {
  total: number;
  promedioLikert: number;
  totalLikertRespuestas: number;
  pctPerfilEgreso: number;
  countPerfilEgreso: number;
  pctRecursos: number;
  countRecursos: number;
  pctMejora: number;
  countMejora: number;
  pctAutoevaluacion: number;
  countAutoevaluacion: number;
  pctComentarios: number;
  countComentarios: number;
}

@Component({
  standalone: true,
  selector: 'app-egresados-analisis',
  imports: [
    CommonModule,
    HttpClientModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './egresados-analisis.component.html',
  styleUrls: ['./egresados-analisis.component.scss'],
})
export class EgresadosAnalisisComponent implements OnInit {
  private api = inject(EncuestasEgresadosService);

  isLoading = false;
  encuestas: EgresadoEncuestaRow[] = [];

  empleabilidad: EmpleabilidadStats = {
    total: 0,
    totalTrabajando: 0,
    pctTrabajando: 0,
    countTrabajando: 0,
    pctPostgrado: 0,
    countPostgrado: 0,
    pctCapacitacion: 0,
    countCapacitacion: 0,
    pctPertinenciaAlta: 0,
    countPertinenciaAlta: 0,
    pctEmpleoRapido: 0,
    countEmpleoRapido: 0,
    pctRentaAlta: 0,
    countRentaAlta: 0,
    pctJefatura: 0,
    countJefatura: 0,
    genero: { mujer: 0, hombre: 0, noResponde: 0 },
    generoCounts: { mujer: 0, hombre: 0, noResponde: 0 },
    trabajandoGenero: { mujer: 0, hombre: 0, noResponde: 0 },
    trabajandoGeneroCounts: { mujer: 0, hombre: 0, noResponde: 0 },
    sector: { publico: 0, privado: 0, otro: 0 },
    sectorCounts: { publico: 0, privado: 0, otro: 0 },
  };

  acreditacion: AcreditacionStats = {
    total: 0,
    promedioLikert: 0,
    totalLikertRespuestas: 0,
    pctPerfilEgreso: 0,
    countPerfilEgreso: 0,
    pctRecursos: 0,
    countRecursos: 0,
    pctMejora: 0,
    countMejora: 0,
    pctAutoevaluacion: 0,
    countAutoevaluacion: 0,
    pctComentarios: 0,
    countComentarios: 0,
  };

  private readonly likertMap: Record<string, number> = {
    'Muy en desacuerdo': 1,
    'En desacuerdo': 2,
    'Ni de acuerdo ni en desacuerdo': 3,
    'De acuerdo': 4,
    'Muy de acuerdo': 5,
  };

  ngOnInit(): void {
    this.loadEncuestas();
  }

  private loadEncuestas(): void {
    this.isLoading = true;
    this.api.getAll().subscribe({
      next: (data) => {
        this.encuestas = (data || []) as EgresadoEncuestaRow[];
        this.isLoading = false;
        this.buildStats();
      },
      error: () => {
        this.encuestas = [];
        this.isLoading = false;
        this.buildStats();
      },
    });
  }

  private buildStats(): void {
    const empleabilidad = this.encuestas.filter((e) => e.tipo === 'EMPLEABILIDAD');
    const acreditacion = this.encuestas.filter((e) => e.tipo === 'ACREDITACION');

    this.empleabilidad = this.buildEmpleabilidadStats(empleabilidad);
    this.acreditacion = this.buildAcreditacionStats(acreditacion);
  }

  private buildEmpleabilidadStats(encuestas: EgresadoEncuestaRow[]): EmpleabilidadStats {
    const total = encuestas.length;
    const countWorking = this.countByRespuesta(encuestas, 'insercion.trabajaActualmente', 'Si');
    const countPostgrado = this.countByRespuesta(encuestas, 'percepcion.postgrado', 'Si');
    const countCapacitacion = this.countByRespuesta(encuestas, 'percepcion.capacitacion', 'Si');
    const countPertinencia = this.countAgreement(encuestas, 'percepcion.pertinencia');
    const countEmpleoRapido = encuestas.filter((e) => {
      const value = this.getRespuesta(e, 'insercion.tiempoPrimerTrabajo');
      return value === 'Menos de 2 meses' || value === 'Entre 2 y 6 meses';
    }).length;
    const countRentaAlta = encuestas.filter((e) => {
      const value = this.getRespuesta(e, 'condiciones.renta');
      return value === 'Entre $1.000.001 y $1.500.000' || value === 'Mas de $1.500.001';
    }).length;
    const countJefatura = this.countByRespuesta(encuestas, 'insercion.situacionLaboral', 'Jefatura');

    const genero = { mujer: 0, hombre: 0, noResponde: 0 };
    const trabajandoGenero = { mujer: 0, hombre: 0, noResponde: 0 };
    const sector = { publico: 0, privado: 0, otro: 0 };

    for (const encuesta of encuestas) {
      const sexo = String((encuesta?.generales ?? {})['sexo'] ?? '').trim();
      const isMujer = sexo === 'Mujer';
      const isHombre = sexo === 'Hombre';
      const isNoResp = sexo === 'Prefiere no responder';

      if (isMujer) genero.mujer += 1;
      else if (isHombre) genero.hombre += 1;
      else if (isNoResp) genero.noResponde += 1;

      const trabaja = this.getRespuesta(encuesta, 'insercion.trabajaActualmente');
      if (trabaja !== 'Si') continue;

      if (isMujer) trabajandoGenero.mujer += 1;
      else if (isHombre) trabajandoGenero.hombre += 1;
      else if (isNoResp) trabajandoGenero.noResponde += 1;

      const sectorValue = this.getRespuesta(encuesta, 'insercion.sectorTrabajo');
      if (sectorValue === 'Publico') sector.publico += 1;
      else if (sectorValue === 'Privado') sector.privado += 1;
      else if (sectorValue === 'Otro') sector.otro += 1;
    }

    return {
      total,
      totalTrabajando: countWorking,
      pctTrabajando: this.pct(countWorking, total),
      countTrabajando: countWorking,
      pctPostgrado: this.pct(countPostgrado, total),
      countPostgrado,
      pctCapacitacion: this.pct(countCapacitacion, total),
      countCapacitacion,
      pctPertinenciaAlta: this.pct(countPertinencia, total),
      countPertinenciaAlta: countPertinencia,
      pctEmpleoRapido: this.pct(countEmpleoRapido, total),
      countEmpleoRapido,
      pctRentaAlta: this.pct(countRentaAlta, total),
      countRentaAlta,
      pctJefatura: this.pct(countJefatura, total),
      countJefatura,
      genero: {
        mujer: this.pct(genero.mujer, total),
        hombre: this.pct(genero.hombre, total),
        noResponde: this.pct(genero.noResponde, total),
      },
      generoCounts: {
        mujer: genero.mujer,
        hombre: genero.hombre,
        noResponde: genero.noResponde,
      },
      trabajandoGenero: {
        mujer: this.pct(trabajandoGenero.mujer, genero.mujer),
        hombre: this.pct(trabajandoGenero.hombre, genero.hombre),
        noResponde: this.pct(trabajandoGenero.noResponde, genero.noResponde),
      },
      trabajandoGeneroCounts: {
        mujer: trabajandoGenero.mujer,
        hombre: trabajandoGenero.hombre,
        noResponde: trabajandoGenero.noResponde,
      },
      sector: {
        publico: this.pct(sector.publico, countWorking),
        privado: this.pct(sector.privado, countWorking),
        otro: this.pct(sector.otro, countWorking),
      },
      sectorCounts: {
        publico: sector.publico,
        privado: sector.privado,
        otro: sector.otro,
      },
    };
  }

  private buildAcreditacionStats(encuestas: EgresadoEncuestaRow[]): AcreditacionStats {
    const total = encuestas.length;
    const promedioLikert = this.calcLikertPromedio(encuestas);
    const totalLikertRespuestas = this.countLikertRespuestas(encuestas);
    const countPerfilEgreso = this.countAgreement(encuestas, 'secciones.perfilEgreso.p2');
    const countRecursos = this.countAgreement(encuestas, 'secciones.gestionRecursos.p13');
    const countMejora = this.countAgreement(encuestas, 'secciones.autorregulacion.p18');
    const countAutoevaluacion = this.countAgreement(encuestas, 'secciones.autorregulacion.p17');
    const countComentarios = this.countConComentarios(encuestas);

    return {
      total,
      promedioLikert,
      totalLikertRespuestas,
      pctPerfilEgreso: this.pct(countPerfilEgreso, total),
      countPerfilEgreso,
      pctRecursos: this.pct(countRecursos, total),
      countRecursos,
      pctMejora: this.pct(countMejora, total),
      countMejora,
      pctAutoevaluacion: this.pct(countAutoevaluacion, total),
      countAutoevaluacion,
      pctComentarios: this.pct(countComentarios, total),
      countComentarios,
    };
  }

  private getRespuesta(encuesta: EgresadoEncuestaRow, key: string): string | null {
    const respuestas = encuesta.respuestas || [];
    for (const r of respuestas) {
      const desc = r?.pregunta?.descripcion ?? '';
      if (desc === key) {
        return r?.alternativa?.descripcion ?? r?.respuestaAbierta ?? null;
      }
    }
    return null;
  }

  private countByRespuesta(
    encuestas: EgresadoEncuestaRow[],
    key: string,
    target: string,
  ): number {
    return encuestas.filter((e) => this.getRespuesta(e, key) === target).length;
  }

  private countAgreement(encuestas: EgresadoEncuestaRow[], key: string): number {
    return encuestas.filter((e) => {
      const value = this.getRespuesta(e, key);
      return value === 'De acuerdo' || value === 'Muy de acuerdo';
    }).length;
  }

  private calcLikertPromedio(encuestas: EgresadoEncuestaRow[]): number {
    let total = 0;
    let count = 0;
    for (const encuesta of encuestas) {
      for (const r of encuesta.respuestas || []) {
        const key = r?.pregunta?.descripcion ?? '';
        if (!key.startsWith('secciones.')) continue;
        const value = r?.alternativa?.descripcion ?? r?.respuestaAbierta ?? '';
        const score = this.likertMap[value];
        if (!score) continue;
        total += score;
        count += 1;
      }
    }
    if (!count) return 0;
    return Math.round((total / count / 5) * 100);
  }

  private countLikertRespuestas(encuestas: EgresadoEncuestaRow[]): number {
    let count = 0;
    for (const encuesta of encuestas) {
      for (const r of encuesta.respuestas || []) {
        const key = r?.pregunta?.descripcion ?? '';
        if (!key.startsWith('secciones.')) continue;
        const value = r?.alternativa?.descripcion ?? r?.respuestaAbierta ?? '';
        if (this.likertMap[value]) count += 1;
      }
    }
    return count;
  }

  private countConComentarios(encuestas: EgresadoEncuestaRow[]): number {
    return encuestas.filter((e) =>
      (e.respuestas || []).some((r) => {
        const key = r?.pregunta?.descripcion ?? '';
        const value = (r?.respuestaAbierta ?? '').trim();
        return key.startsWith('abiertas.') && value.length > 0;
      }),
    ).length;
  }

  private pct(value: number, total: number): number {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  }
}
