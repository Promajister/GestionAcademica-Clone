import { AlcanceBloqueProtegido, TipoContrato } from '@prisma/client';
import { BLOQUES_PEDAGOGICOS, mismaJornada } from '../common/grilla';

// GEN-F01: generador de la propuesta de horario.
// Es una función pura (sin base de datos) para poder probarla con casos armados.

export const DIAS_HABILES = [1, 2, 3, 4, 5]; // id_dia de lunes a viernes

export interface DocenteEntrada {
  id_carga: number;
  id_usuario: number;
  nombre: string;
  contrato: TipoContrato;
  // Bloques declarados en DIS-F02 como `${id_dia}-${bloque}`. Solo aplica a contratos por horas.
  disponibilidad: Set<string>;
}

export interface CursoEntrada {
  id_curso: number;
  codigo: string;
  nombre: string;
  grupo: string;
  inscritos: number;
  bloques: number; // bloques de 45 min por semana
  nivel: number; // semestre de la malla
  codigo_carrera: string | null;
  // Mismo plan y nivel: los estudiantes no pueden estar en dos clases a la vez,
  // salvo grupos distintos de la misma asignatura (son estudiantes distintos)
  cohorte: string | null;
  docentes: DocenteEntrada[];
}

export interface SalaEntrada {
  id_sala: number;
  nombre: string;
  capacidad: number;
}

export interface ProtegidoEntrada {
  id_dia: number;
  id_bloque: number;
  nombre: string;
  alcance: AlcanceBloqueProtegido;
  codigo_carrera: string | null;
  semestre: number | null;
  contrato: TipoContrato | null;
  id_usuario: number | null;
  // Alcance SALA: la sala reservada
  id_sala?: number | null;
}

// Bloque ocupado por una asignatura externa (fijo, no lo mueve el generador)
export interface ExternoEntrada {
  id_dia: number;
  id_bloque: number;
  id_sala: number | null;
  cohorte: string | null;
  codigo: string;
  grupo: string;
}

// Lo que se necesita saber de una clase para decidir si un bloque protegido la alcanza
export interface AfectadoPorProtegido {
  codigo_carrera: string | null;
  nivel: number;
  docentes: { id_usuario: number; contrato: TipoContrato }[];
  // Sala de la clase (para las reservas de sala); sin sala, una reserva no la alcanza
  id_sala?: number | null;
}

export interface Sesion {
  id_curso: number;
  id_sala: number;
  id_dia: number;
  bloques: number[];
}

export type MotivoNoAsignada =
  | 'SIN_CARGA'
  | 'SIN_BLOQUES'
  | 'SIN_SALA'
  | 'SIN_DISPONIBILIDAD'
  | 'SIN_BLOQUE_LIBRE';

export interface NoAsignada {
  id_curso: number;
  codigo: string;
  nombre: string;
  grupo: string;
  nivel: number;
  motivo: MotivoNoAsignada;
  detalle: string;
  bloques_requeridos: number;
  bloques_asignados: number;
}

export interface EntradaGenerador {
  cursos: CursoEntrada[];
  salas: SalaEntrada[];
  protegidos: ProtegidoEntrada[];
  externos: ExternoEntrada[];
}

export interface ResultadoGenerador {
  sesiones: Sesion[];
  no_asignadas: NoAsignada[];
}

const clave = (id_dia: number, bloque: number) => `${id_dia}-${bloque}`;

// Un bloque protegido afecta al curso si alcanza a sus estudiantes o a alguno de sus docentes
export function protegidoAfecta(
  p: Pick<
    ProtegidoEntrada,
    | 'alcance'
    | 'codigo_carrera'
    | 'semestre'
    | 'contrato'
    | 'id_usuario'
    | 'id_sala'
  >,
  c: AfectadoPorProtegido,
): boolean {
  switch (p.alcance) {
    case AlcanceBloqueProtegido.UNIVERSIDAD:
    case AlcanceBloqueProtegido.FACULTAD:
      return true;
    case AlcanceBloqueProtegido.CARRERA:
      return p.codigo_carrera === c.codigo_carrera;
    case AlcanceBloqueProtegido.ESTUDIANTES:
    case AlcanceBloqueProtegido.PRACTICA_PREPRACTICA:
      return p.codigo_carrera === c.codigo_carrera && p.semestre === c.nivel;
    case AlcanceBloqueProtegido.ACADEMICOS:
      return c.docentes.some((d) => !p.contrato || p.contrato === d.contrato);
    case AlcanceBloqueProtegido.ACADEMICO_INDIVIDUAL:
      return c.docentes.some((d) => d.id_usuario === p.id_usuario);
    // Reserva de sala: alcanza a la clase que está en esa sala
    case AlcanceBloqueProtegido.SALA:
      return p.id_sala != null && p.id_sala === c.id_sala;
    default:
      return false;
  }
}

// Clases de 2 bloques seguidos (1-2, 3-4, ...); si el total es impar, una sesión de 1 bloque
export function dividirEnSesiones(bloques: number): number[] {
  const sesiones: number[] = [];
  for (let resto = bloques; resto > 0; resto -= 2) {
    sesiones.push(Math.min(2, resto));
  }
  return sesiones;
}

function iniciosPosibles(largo: number): number[] {
  const inicios: number[] = [];
  for (const b of BLOQUES_PEDAGOGICOS) {
    const fin = b.numero + largo - 1;
    if (fin > BLOQUES_PEDAGOGICOS.length) continue;
    if (!mismaJornada(b.numero, fin)) continue;
    // Las sesiones de 2 bloques parten en bloque impar para no partir los pares de la grilla
    if (largo === 2 && b.numero % 2 === 0) continue;
    inicios.push(b.numero);
  }
  return inicios;
}

const usaDisponibilidad = (d: DocenteEntrada) =>
  d.contrato === TipoContrato.HORAS;

export function generarPropuesta(e: EntradaGenerador): ResultadoGenerador {
  const salaOcupada = new Set<string>(); // `${id_sala}-${dia}-${bloque}`
  const docenteOcupado = new Set<string>(); // `${id_usuario}-${dia}-${bloque}`
  // `${cohorte}-${dia}-${bloque}` -> asignaturas y grupos que ya ocupan ese bloque
  const cohorteOcupada = new Map<string, { codigo: string; grupo: string }[]>();
  const ocuparCohorte = (k: string, codigo: string, grupo: string) =>
    cohorteOcupada.set(k, [
      ...(cohorteOcupada.get(k) ?? []),
      { codigo, grupo },
    ]);
  const cargaCohorte = new Map<string, number>(); // `${cohorte}-${dia}` -> bloques
  const usoSala = new Map<number, number>();

  // Las salas reservadas (bloque protegido de alcance SALA) no se usan en esos bloques
  for (const p of e.protegidos) {
    if (p.alcance === AlcanceBloqueProtegido.SALA && p.id_sala != null) {
      salaOcupada.add(`${p.id_sala}-${p.id_dia}-${p.id_bloque}`);
    }
  }

  for (const x of e.externos) {
    if (x.id_sala != null) {
      salaOcupada.add(`${x.id_sala}-${x.id_dia}-${x.id_bloque}`);
    }
    if (x.cohorte) {
      ocuparCohorte(
        `${x.cohorte}-${x.id_dia}-${x.id_bloque}`,
        x.codigo,
        x.grupo,
      );
    }
  }

  const sesiones: Sesion[] = [];
  const no_asignadas: NoAsignada[] = [];

  const salasPorTamano = [...e.salas].sort(
    (a, b) => a.capacidad - b.capacidad || a.id_sala - b.id_sala,
  );
  const capacidadMaxima = salasPorTamano.length
    ? salasPorTamano[salasPorTamano.length - 1].capacidad
    : 0;

  // Primero los cursos más restringidos: docentes por horas con poca disponibilidad
  // y luego los que necesitan más bloques
  const holgura = (c: CursoEntrada) => {
    const porHoras = c.docentes.filter(usaDisponibilidad);
    return porHoras.length
      ? Math.min(...porHoras.map((d) => d.disponibilidad.size))
      : Number.MAX_SAFE_INTEGER;
  };
  const ordenados = [...e.cursos].sort(
    (a, b) =>
      holgura(a) - holgura(b) ||
      b.bloques - a.bloques ||
      b.inscritos - a.inscritos ||
      a.codigo.localeCompare(b.codigo) ||
      a.id_curso - b.id_curso,
  );

  for (const c of ordenados) {
    const base = {
      id_curso: c.id_curso,
      codigo: c.codigo,
      nombre: c.nombre,
      grupo: c.grupo,
      nivel: c.nivel,
      bloques_requeridos: c.bloques,
    };

    if (c.docentes.length === 0) {
      no_asignadas.push({
        ...base,
        motivo: 'SIN_CARGA',
        detalle: 'No tiene docente asignado en la carga docente',
        bloques_asignados: 0,
      });
      continue;
    }
    if (c.bloques <= 0) {
      no_asignadas.push({
        ...base,
        motivo: 'SIN_BLOQUES',
        detalle: 'La asignatura no tiene horas semanales registradas',
        bloques_asignados: 0,
      });
      continue;
    }

    const salasAptas = salasPorTamano.filter((s) => s.capacidad >= c.inscritos);
    if (salasAptas.length === 0) {
      no_asignadas.push({
        ...base,
        motivo: 'SIN_SALA',
        detalle: `Ninguna sala de clases activa tiene capacidad para ${c.inscritos} inscritos (máximo ${capacidadMaxima})`,
        bloques_asignados: 0,
      });
      continue;
    }

    const sinDeclarar = c.docentes.filter(
      (d) => usaDisponibilidad(d) && d.disponibilidad.size === 0,
    );
    if (sinDeclarar.length) {
      no_asignadas.push({
        ...base,
        motivo: 'SIN_DISPONIBILIDAD',
        detalle: `${sinDeclarar.map((d) => d.nombre).join(', ')} (por horas) no ha declarado su disponibilidad`,
        bloques_asignados: 0,
      });
      continue;
    }

    const protegidos = new Set(
      e.protegidos
        .filter((p) => protegidoAfecta(p, c))
        .map((p) => clave(p.id_dia, p.id_bloque)),
    );

    // Choca con el nivel si a esa hora hay otra clase de sus estudiantes: otra asignatura,
    // o la misma asignatura y el mismo grupo (por ejemplo su taller). Otro grupo no choca.
    const chocaNivel = (dia: number, b: number) =>
      !!c.cohorte &&
      (cohorteOcupada.get(`${c.cohorte}-${dia}-${b}`) ?? []).some(
        (o) => o.codigo !== c.codigo || o.grupo === c.grupo,
      );

    // Libre en tiempo: sin protegido, sin clase del mismo nivel y con los docentes libres
    const bloqueLibre = (dia: number, b: number, conDisponibilidad: boolean) =>
      !protegidos.has(clave(dia, b)) &&
      !chocaNivel(dia, b) &&
      c.docentes.every(
        (d) =>
          !docenteOcupado.has(`${d.id_usuario}-${dia}-${b}`) &&
          (!conDisponibilidad ||
            !usaDisponibilidad(d) ||
            d.disponibilidad.has(clave(dia, b))),
      );

    const diasUsados = new Set<number>();
    let asignados = 0;
    let falla: Omit<
      NoAsignada,
      keyof typeof base | 'bloques_asignados'
    > | null = null;

    for (const largo of dividirEnSesiones(c.bloques)) {
      const inicios = iniciosPosibles(largo);
      // Reparte la semana: días que el curso aún no usa y con menos clases de su nivel
      const dias = [...DIAS_HABILES].sort(
        (a, b) =>
          Number(diasUsados.has(a)) - Number(diasUsados.has(b)) ||
          (cargaCohorte.get(`${c.cohorte}-${a}`) ?? 0) -
            (cargaCohorte.get(`${c.cohorte}-${b}`) ?? 0) ||
          a - b,
      );

      let ubicada: Sesion | null = null;
      let hayTiempo = false;
      let hayTiempoSinDisponibilidad = false;

      for (const dia of dias) {
        for (const inicio of inicios) {
          const bloques = Array.from({ length: largo }, (_, i) => inicio + i);
          if (bloques.every((b) => bloqueLibre(dia, b, false))) {
            hayTiempoSinDisponibilidad = true;
          }
          if (!bloques.every((b) => bloqueLibre(dia, b, true))) continue;
          hayTiempo = true;

          // Sala más chica que alcance el cupo y esté libre; a igual tamaño, la menos usada
          const sala = salasAptas
            .filter((s) =>
              bloques.every(
                (b) => !salaOcupada.has(`${s.id_sala}-${dia}-${b}`),
              ),
            )
            .sort(
              (a, b) =>
                a.capacidad - b.capacidad ||
                (usoSala.get(a.id_sala) ?? 0) - (usoSala.get(b.id_sala) ?? 0) ||
                a.id_sala - b.id_sala,
            )[0];
          if (!sala) continue;

          ubicada = {
            id_curso: c.id_curso,
            id_sala: sala.id_sala,
            id_dia: dia,
            bloques,
          };
          break;
        }
        if (ubicada) break;
      }

      if (!ubicada) {
        falla = hayTiempo
          ? {
              motivo: 'SIN_SALA',
              detalle:
                'No queda una sala libre con capacidad en los bloques disponibles',
            }
          : hayTiempoSinDisponibilidad
            ? {
                motivo: 'SIN_DISPONIBILIDAD',
                detalle: `La disponibilidad declarada por ${c.docentes
                  .filter(usaDisponibilidad)
                  .map((d) => d.nombre)
                  .join(', ')} no deja bloques libres`,
              }
            : {
                motivo: 'SIN_BLOQUE_LIBRE',
                detalle:
                  'No quedan bloques libres sin bloques protegidos, asignaturas externas o clases del mismo nivel o del docente',
              };
        continue;
      }

      sesiones.push(ubicada);
      diasUsados.add(ubicada.id_dia);
      asignados += largo;
      usoSala.set(ubicada.id_sala, (usoSala.get(ubicada.id_sala) ?? 0) + largo);
      const kDia = `${c.cohorte}-${ubicada.id_dia}`;
      cargaCohorte.set(kDia, (cargaCohorte.get(kDia) ?? 0) + largo);
      for (const b of ubicada.bloques) {
        salaOcupada.add(`${ubicada.id_sala}-${ubicada.id_dia}-${b}`);
        if (c.cohorte)
          ocuparCohorte(
            `${c.cohorte}-${ubicada.id_dia}-${b}`,
            c.codigo,
            c.grupo,
          );
        for (const d of c.docentes) {
          docenteOcupado.add(`${d.id_usuario}-${ubicada.id_dia}-${b}`);
        }
      }
    }

    if (falla) {
      no_asignadas.push({
        ...base,
        ...falla,
        detalle:
          asignados > 0
            ? `${falla.detalle} (se asignaron ${asignados} de ${c.bloques} bloques)`
            : falla.detalle,
        bloques_asignados: asignados,
      });
    }
  }

  no_asignadas.sort(
    (a, b) => a.nivel - b.nivel || a.codigo.localeCompare(b.codigo),
  );
  return { sesiones, no_asignadas };
}
