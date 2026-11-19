import { Actividad } from './actividades';

// GEN-F03 / GEN-F04: validadores de cruces sobre el horario completo (propias y externas)

export interface ActividadCruce {
  id: string;
  codigo: string;
  nombre: string;
  origen: Actividad['origen'];
  sala: string | null;
}

export interface CruceSala {
  id_sala: number;
  sala: string;
  id_dia: number;
  dia: string;
  bloque_inicio: number;
  bloque_fin: number;
  actividades: ActividadCruce[];
  mensaje: string;
}

export interface CruceDocente {
  id_usuario: number;
  docente: string;
  id_dia: number;
  dia: string;
  bloque_inicio: number;
  bloque_fin: number;
  actividades: ActividadCruce[];
  mensaje: string;
}

const DIAS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

const rango = (inicio: number, fin: number) =>
  inicio === fin ? `bloque ${inicio}` : `bloques ${inicio}-${fin}`;

const resumen = (a: Actividad): ActividadCruce => ({
  id: a.id,
  codigo: a.codigo,
  nombre: a.nombre,
  origen: a.origen,
  sala: a.sala ?? a.sala_externa,
});

const describir = (acts: ActividadCruce[]) =>
  acts.map((a) => `${a.codigo} ${a.nombre}`).join(' y ');

interface Coincidencia<T> {
  clave: T;
  id_dia: number;
  bloque_inicio: number;
  bloque_fin: number;
  actividades: Actividad[];
}

// Busca, para cada recurso (sala o docente) y día, los bloques donde coinciden dos o más cursos.
// Bloques seguidos con las mismas actividades se informan juntos (ej. bloques 3-4).
function coincidencias<T extends string | number>(
  actividades: Actividad[],
  recursos: (a: Actividad) => T[],
): Coincidencia<T>[] {
  const porRecursoDia = new Map<
    string,
    { clave: T; id_dia: number; acts: Actividad[] }
  >();
  for (const a of actividades) {
    for (const r of recursos(a)) {
      const k = `${r}|${a.id_dia}`;
      const g = porRecursoDia.get(k) ?? {
        clave: r,
        id_dia: a.id_dia,
        acts: [],
      };
      g.acts.push(a);
      porRecursoDia.set(k, g);
    }
  }

  const resultado: Coincidencia<T>[] = [];
  for (const { clave, id_dia, acts } of porRecursoDia.values()) {
    if (acts.length < 2) continue;
    let abierta: Coincidencia<T> | null = null;
    let firma = '';
    for (let b = 1; b <= 12; b++) {
      const aqui = acts.filter(
        (a) => b >= a.bloque_inicio && b <= a.bloque_fin,
      );
      const cursos = new Set(aqui.map((a) => `${a.origen}-${a.id_curso}`));
      const f =
        cursos.size >= 2
          ? aqui
              .map((a) => a.id)
              .sort()
              .join(',')
          : '';
      if (
        f &&
        abierta &&
        f === firma &&
        b === abierta.bloque_fin + 1 &&
        b !== 7
      ) {
        abierta.bloque_fin = b;
        continue;
      }
      abierta = null;
      firma = f;
      if (f) {
        abierta = {
          clave,
          id_dia,
          bloque_inicio: b,
          bloque_fin: b,
          actividades: aqui,
        };
        resultado.push(abierta);
      }
    }
  }
  return resultado.sort(
    (x, y) => x.id_dia - y.id_dia || x.bloque_inicio - y.bloque_inicio,
  );
}

// GEN-F03: dos actividades en la misma sala del departamento, día y bloque
export function crucesDeSala(actividades: Actividad[]): CruceSala[] {
  const nombres = new Map<number, string>();
  for (const a of actividades) {
    if (a.id_sala != null)
      nombres.set(a.id_sala, a.sala ?? `Sala ${a.id_sala}`);
  }
  return coincidencias(actividades, (a) =>
    a.id_sala != null ? [a.id_sala] : [],
  ).map((c) => {
    const sala = nombres.get(c.clave) ?? `Sala ${c.clave}`;
    const acts = c.actividades.map(resumen);
    return {
      id_sala: c.clave,
      sala,
      id_dia: c.id_dia,
      dia: DIAS[c.id_dia] ?? String(c.id_dia),
      bloque_inicio: c.bloque_inicio,
      bloque_fin: c.bloque_fin,
      actividades: acts,
      mensaje: `${sala}, ${DIAS[c.id_dia]} ${rango(c.bloque_inicio, c.bloque_fin)}: ${describir(acts)}`,
    };
  });
}

// GEN-F04: un mismo docente en dos actividades del mismo día y bloque (en cualquier sala)
export function crucesDeDocente(actividades: Actividad[]): CruceDocente[] {
  const nombres = new Map<number, string>();
  for (const a of actividades) {
    for (const d of a.docentes) nombres.set(d.id_usuario, d.nombre);
  }
  return coincidencias(actividades, (a) =>
    a.docentes.map((d) => d.id_usuario),
  ).map((c) => {
    const docente = nombres.get(c.clave) ?? `Docente ${c.clave}`;
    const acts = c.actividades.map(resumen);
    const detalle = acts
      .map((a) => `${a.codigo} ${a.nombre} (${a.sala ?? 'sin sala'})`)
      .join(' y ');
    return {
      id_usuario: c.clave,
      docente,
      id_dia: c.id_dia,
      dia: DIAS[c.id_dia] ?? String(c.id_dia),
      bloque_inicio: c.bloque_inicio,
      bloque_fin: c.bloque_fin,
      actividades: acts,
      mensaje: `${docente}, ${DIAS[c.id_dia]} ${rango(c.bloque_inicio, c.bloque_fin)}: ${detalle}`,
    };
  });
}
