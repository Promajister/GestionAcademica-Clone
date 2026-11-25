import { TipoContrato } from '@prisma/client';
import { mismaJornada } from '../common/grilla';

export type OrigenActividad = 'INTERNA' | 'EXTERNA';

export interface DocenteActividad {
  id_usuario: number;
  nombre: string;
  // Para saber si un bloque protegido de académicos alcanza a la clase
  contrato?: TipoContrato;
}

// Un bloque de 45 min ocupado por una clase (propia o externa)
export interface BloqueActividad {
  origen: OrigenActividad;
  id_curso: number;
  codigo: string;
  nombre: string;
  grupo: string;
  nivel: number;
  id_plan: number | null;
  codigo_carrera: string | null;
  id_dia: number;
  dia: string;
  id_bloque: number;
  id_sala: number | null;
  sala: string | null;
  sala_externa: string | null;
  docentes: DocenteActividad[];
}

// Bloques seguidos de un mismo curso, día y sala: lo que la grilla dibuja como una clase
export interface Actividad {
  id: string;
  origen: OrigenActividad;
  id_curso: number;
  codigo: string;
  nombre: string;
  grupo: string;
  nivel: number;
  id_plan: number | null;
  codigo_carrera: string | null;
  id_dia: number;
  dia: string;
  bloque_inicio: number;
  bloque_fin: number;
  id_sala: number | null;
  sala: string | null;
  sala_externa: string | null;
  docentes: DocenteActividad[];
}

const lugar = (b: { id_sala: number | null; sala_externa: string | null }) =>
  b.id_sala != null ? `s${b.id_sala}` : `x${b.sala_externa ?? ''}`;

export const idActividad = (a: {
  origen: OrigenActividad;
  id_curso: number;
  id_dia: number;
  bloque_inicio: number;
  id_sala: number | null;
  sala_externa: string | null;
}) => `${a.origen}-${a.id_curso}-${a.id_dia}-${a.bloque_inicio}-${lugar(a)}`;

export function agruparActividades(bloques: BloqueActividad[]): Actividad[] {
  const ordenados = [...bloques].sort(
    (a, b) =>
      a.origen.localeCompare(b.origen) ||
      a.id_curso - b.id_curso ||
      a.id_dia - b.id_dia ||
      lugar(a).localeCompare(lugar(b)) ||
      a.id_bloque - b.id_bloque,
  );

  const actividades: Actividad[] = [];
  let actual: Actividad | null = null;

  for (const b of ordenados) {
    const continua =
      actual &&
      actual.origen === b.origen &&
      actual.id_curso === b.id_curso &&
      actual.id_dia === b.id_dia &&
      lugar(actual) === lugar(b) &&
      b.id_bloque === actual.bloque_fin + 1 &&
      mismaJornada(actual.bloque_inicio, b.id_bloque);

    if (actual && continua) {
      actual.bloque_fin = b.id_bloque;
      for (const d of b.docentes) {
        if (!actual.docentes.some((x) => x.id_usuario === d.id_usuario)) {
          actual.docentes.push(d);
        }
      }
      continue;
    }

    actual = {
      id: '',
      origen: b.origen,
      id_curso: b.id_curso,
      codigo: b.codigo,
      nombre: b.nombre,
      grupo: b.grupo,
      nivel: b.nivel,
      id_plan: b.id_plan,
      codigo_carrera: b.codigo_carrera,
      id_dia: b.id_dia,
      dia: b.dia,
      bloque_inicio: b.id_bloque,
      bloque_fin: b.id_bloque,
      id_sala: b.id_sala,
      sala: b.sala,
      sala_externa: b.sala_externa,
      docentes: [...b.docentes],
    };
    actividades.push(actual);
  }

  for (const a of actividades) a.id = idActividad(a);
  return actividades.sort(
    (a, b) =>
      a.id_dia - b.id_dia ||
      a.bloque_inicio - b.bloque_inicio ||
      a.codigo.localeCompare(b.codigo),
  );
}
