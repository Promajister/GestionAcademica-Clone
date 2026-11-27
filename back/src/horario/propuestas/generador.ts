/**
 * ============================================================================
 *  GENERADOR DE PROPUESTA DE HORARIO
 * ============================================================================
 *
 * Qué se planifica
 * ----------------
 * Los CURSOS de las asignaturas propias de UN plan, para
 * UN período (primer o segundo semestre del año).
 * Cada curso necesita tantos bloques como horas tenga su asignatura para su tipo
 * (catedraSemanal / tallerSemanal / labSemanal).
 *
 * Tomando en cuenta...
 * --------------
 * - Asignaturas externas: sus bloques (HorarioExterno) vienen fijos y solo
 *   se usan como bloques ocupados (en su nivel y en su sala).
 * - Bloques protegidos: nunca se usan.
 * - Lo que otros planes tengan ocupado: se respeta (en su nivel, en sus salas y con sus docentes).
 *
 * Reglas de negocio
 * -----------------
 *  R1. Los bloques se asignan en pares alineados: 1-2, 3-4, 5-6, 7-8, 9-10,
 *      11-12 (nunca 2-3). Un curso de 4 bloques recibe 2 pares; de 6, 3 pares...
 *      Si la cantidad es impar, la última sesión es de 1 bloque y usa el primer
 *      bloque de un par.
 *  R2. Las sesiones de un mismo curso van en días distintos.
 *  R3. Dentro de un nivel no se superponen clases (los estudiantes son los
 *      mismos): ni con otros cursos del nivel, ni con externas del nivel, ni con
 *      bloques protegidos que aplican al nivel.
 *  R4. Una sala tiene un solo curso por bloque, es de tipo CLASES y su
 *      capacidad debe ser >= inscritos. Si el curso tiene 0 inscritos no se
 *      valida capacidad (advertencia SIN_INSCRITOS).
 *  R5. Un docente tiene un solo curso por bloque (en cualquier nivel o plan).
 *  R6. Disponibilidad del docente:
 *        - PLANTA: todos los bloques.
 *        - HORAS: solo los bloques que declaró; si no declaró nada, 0 bloques.
 *        - En ambos casos se descuentan sus bloques protegidos (ACADEMICOS /
 *          ACADEMICO_INDIVIDUAL).
 *      Si el curso tiene varios docentes, todos deben estar disponibles.
 *  R7. Curso sin docente: se programa como si el docente estuviera siempre
 *      disponible y se marca con la advertencia SIN_DOCENTE (no detiene nada).
 *
 * Estrategia greedy
 * -------------------
 *  Paso 1. Copiar las ocupaciones de entrada (no se muta la entrada).
 *  Paso 2. Dividir los bloques de cada curso en sesiones (R1).
 *  Paso 3. Ordenar los cursos del más restringido al menos restringido, para
 *          que los difíciles elijan primero.
 *  Paso 4. Para cada sesión de cada curso, recorrer los candidatos (día, par)
 *          ordenados por los días menos cargados del nivel, y quedarse con el
 *          primero que pase los filtros, en este orden:
 *            4a. bloques libres en el nivel (R3)
 *            4b. disponibilidad del docente (R6)
 *            4c. docente libre (R5)
 *            4d. sala libre con capacidad (R4)
 *  Paso 5. Registrar la sesión elegida como ocupación (nivel, sala, docentes).
 *  Paso 6. Si una sesión no encuentra lugar, el motivo es el filtro más
 *          profundo que alcanzó algún candidato (ver `motivoPorEtapa`).
 *  Paso 7. Calcular estado (ASIGNADO / PARCIAL / NO_ASIGNADO) y advertencias.
 *
 * Limitación conocida: no hay retroceso (backtracking). Si un curso toma un
 * hueco que a otro le servía más, no se corrige. El orden del paso 3 reduce
 * ese caso.
 */

// ---------------------------------------------------------------------------
// Tipos de entrada / salida
// ---------------------------------------------------------------------------

export const DIAS_GENERACION = [
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
] as const;
export type DiaGeneracion = (typeof DIAS_GENERACION)[number];

// Pares alineados de la grilla (R1). Ninguno cruza la colación (6 | 7).
export const PARES_DE_BLOQUES: readonly [number, number][] = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 12],
];

export type TipoCursoGen = 'CATEDRA' | 'TALLER' | 'LABORATORIO';
export type ContratoGen = 'PLANTA' | 'HORAS';

export type MotivoNoAsignado =
  | 'SIN_BLOQUES_LIBRES'
  | 'DOCENTE_SIN_DISPONIBILIDAD'
  | 'DOCENTE_OCUPADO'
  | 'SIN_SALA_CON_CAPACIDAD';

export type AdvertenciaCurso = 'SIN_DOCENTE' | 'SIN_INSCRITOS';

export type EstadoCursoGen = 'ASIGNADO' | 'PARCIAL' | 'NO_ASIGNADO';

export interface CursoAGenerar {
  id_curso: number;
  tipo: TipoCursoGen;
  grupo: string;
  codigo_asignatura: string;
  nombre_asignatura: string;
  nivel: number; // malla.semestre
  bloques_requeridos: number;
  inscritos: number;
  docentes: number[]; // id_usuario de cada CargaDocente del curso
}

export interface DocenteGen {
  id_usuario: number;
  nombre: string;
  contrato: ContratoGen;
  // Solo para HORAS: claves `DIA|bloque` declaradas. Se ignora para PLANTA.
  disponibilidad: Set<string>;
  // Bloques protegidos del docente (ACADEMICOS / ACADEMICO_INDIVIDUAL)
  protegidos: Set<string>;
}

export interface SalaGen {
  id_sala: number;
  nombre: string;
  capacidad: number;
}

export interface EntradaGenerador {
  cursos: CursoAGenerar[];
  docentes: DocenteGen[];
  salas: SalaGen[]; // solo salas activas de tipo CLASES
  // nivel -> claves `DIA|bloque` ya ocupadas (protegidos del nivel + externas del nivel)
  ocupadoPorNivel: Map<number, Set<string>>;
  // claves `id_sala|DIA|bloque` ya ocupadas (externas con sala + otros planes)
  salasOcupadas: Set<string>;
  // claves `id_usuario|DIA|bloque` ya ocupadas (cursos de otros planes)
  docentesOcupados: Set<string>;
}

export interface SesionGenerada {
  dia: DiaGeneracion;
  bloque_inicio: number;
  bloque_fin: number;
  id_sala: number;
  sala_nombre: string;
}

export interface ResultadoCurso {
  id_curso: number;
  estado: EstadoCursoGen;
  sesiones: SesionGenerada[];
  bloques_asignados: number;
  motivo: MotivoNoAsignado | null;
  detalle_motivo: string | null;
  advertencias: AdvertenciaCurso[];
}

// ---------------------------------------------------------------------------
// Claves de ocupación
// ---------------------------------------------------------------------------

export const claveBloque = (dia: string, bloque: number) => `${dia}|${bloque}`;
export const claveSala = (idSala: number, dia: string, bloque: number) =>
  `${idSala}|${dia}|${bloque}`;
export const claveDocente = (idUsuario: number, dia: string, bloque: number) =>
  `${idUsuario}|${dia}|${bloque}`;

// ---------------------------------------------------------------------------
// Paso 2: sesiones de un curso (R1)
// ---------------------------------------------------------------------------

/** 4 -> [2, 2]; 5 -> [2, 2, 1]; 1 -> [1]; 0 -> [] */
export function dividirEnSesiones(bloques: number): number[] {
  const sesiones: number[] = [];
  for (let resto = bloques; resto > 0; resto -= 2) {
    sesiones.push(Math.min(2, resto));
  }
  return sesiones;
}

// ---------------------------------------------------------------------------
// Etapas de filtrado (Paso 4) y motivo (Paso 6)
// ---------------------------------------------------------------------------

// Hasta qué filtro llegó un candidato. Mientras más alto, más cerca estuvo.
enum Etapa {
  NIVEL_OCUPADO = 0, // falló 4a
  DOCENTE_NO_DISPONIBLE = 1, // pasó 4a, falló 4b
  DOCENTE_OCUPADO = 2, // pasó 4b, falló 4c
  SIN_SALA = 3, // pasó 4c, falló 4d
}

const motivoPorEtapa: Record<Etapa, MotivoNoAsignado> = {
  [Etapa.NIVEL_OCUPADO]: 'SIN_BLOQUES_LIBRES',
  [Etapa.DOCENTE_NO_DISPONIBLE]: 'DOCENTE_SIN_DISPONIBILIDAD',
  [Etapa.DOCENTE_OCUPADO]: 'DOCENTE_OCUPADO',
  [Etapa.SIN_SALA]: 'SIN_SALA_CON_CAPACIDAD',
};

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------

export function generarHorario(entrada: EntradaGenerador): ResultadoCurso[] {
  // ---- Paso 1: copiar ocupaciones (la entrada no se modifica) -------------
  const ocupadoPorNivel = new Map<number, Set<string>>();
  for (const [nivel, claves] of entrada.ocupadoPorNivel) {
    ocupadoPorNivel.set(nivel, new Set(claves));
  }
  const ocupadoNivel = (nivel: number) => {
    let set = ocupadoPorNivel.get(nivel);
    if (!set) {
      set = new Set<string>();
      ocupadoPorNivel.set(nivel, set);
    }
    return set;
  };
  const salasOcupadas = new Set(entrada.salasOcupadas);
  const docentesOcupados = new Set(entrada.docentesOcupados);

  const docentes = new Map(entrada.docentes.map((d) => [d.id_usuario, d]));

  // Salas de menor a mayor capacidad: se usa la más chica que alcance y las
  // grandes quedan para los cursos grandes.
  const salas = [...entrada.salas].sort(
    (a, b) => a.capacidad - b.capacidad || a.id_sala - b.id_sala,
  );

  // ¿El docente puede dictar en ese bloque? (R6)
  const docenteDisponible = (d: DocenteGen, dia: string, b: number) => {
    const k = claveBloque(dia, b);
    if (d.protegidos.has(k)) return false;
    if (d.contrato === 'PLANTA') return true;
    return d.disponibilidad.has(k);
  };

  // Cantidad de bloques en que el docente podría dictar (para ordenar, paso 3)
  const bloquesDisponiblesDocente = (d: DocenteGen) => {
    let n = 0;
    for (const dia of DIAS_GENERACION) {
      for (const [b1, b2] of PARES_DE_BLOQUES) {
        if (docenteDisponible(d, dia, b1)) n++;
        if (docenteDisponible(d, dia, b2)) n++;
      }
    }
    return n;
  };

  // ---- Paso 3: ordenar cursos del más restringido al menos ----------------
  //  1° menos bloques disponibles de su(s) docente(s) (sin docente = todos)
  //  2° más bloques requeridos
  //  3° más inscritos (necesita salas más grandes, que son menos)
  //  4° id_curso, para que el resultado sea siempre el mismo
  const TOTAL = DIAS_GENERACION.length * PARES_DE_BLOQUES.length * 2;
  const holgura = (c: CursoAGenerar) => {
    const ds = c.docentes
      .map((id) => docentes.get(id))
      .filter((d): d is DocenteGen => !!d);
    return ds.length ? Math.min(...ds.map(bloquesDisponiblesDocente)) : TOTAL;
  };
  const ordenados = [...entrada.cursos].sort(
    (a, b) =>
      holgura(a) - holgura(b) ||
      b.bloques_requeridos - a.bloques_requeridos ||
      b.inscritos - a.inscritos ||
      a.id_curso - b.id_curso,
  );

  const resultados = new Map<number, ResultadoCurso>();

  for (const curso of ordenados) {
    const docentesCurso = curso.docentes
      .map((id) => docentes.get(id))
      .filter((d): d is DocenteGen => !!d);
    const nivelSet = ocupadoNivel(curso.nivel);
    const validarCapacidad = curso.inscritos > 0;

    // ---- Paso 2: sesiones del curso ---------------------------------------
    const largos = dividirEnSesiones(curso.bloques_requeridos);

    const sesiones: SesionGenerada[] = [];
    const diasUsados = new Set<string>();
    let primeraFalla: Etapa | null = null;

    for (const largo of largos) {
      // ---- Paso 4: candidatos (día, par) ----------------------------------
      // Días ordenados por carga del nivel (menos ocupado primero) para
      // repartir la semana; en empate, el orden natural de la semana.
      const cargaDia = (dia: string) =>
        PARES_DE_BLOQUES.reduce(
          (n, [b1, b2]) =>
            n +
            (nivelSet.has(claveBloque(dia, b1)) ? 1 : 0) +
            (nivelSet.has(claveBloque(dia, b2)) ? 1 : 0),
          0,
        );
      const dias = DIAS_GENERACION.filter((d) => !diasUsados.has(d)) // R2
        .map((d, i) => ({ d, i, carga: cargaDia(d) }))
        .sort((x, y) => x.carga - y.carga || x.i - y.i)
        .map((x) => x.d);

      let elegida: SesionGenerada | null = null;
      let mejorEtapa: Etapa = Etapa.NIVEL_OCUPADO;

      for (const dia of dias) {
        for (const [b1, b2] of PARES_DE_BLOQUES) {
          const bloques = largo === 2 ? [b1, b2] : [b1];

          // 4a. Bloques libres en el nivel (R3)
          if (bloques.some((b) => nivelSet.has(claveBloque(dia, b)))) continue;

          // 4b. Disponibilidad de todos los docentes (R6). Sin docente pasa (R7).
          if (
            docentesCurso.some((d) =>
              bloques.some((b) => !docenteDisponible(d, dia, b)),
            )
          ) {
            mejorEtapa = Math.max(mejorEtapa, Etapa.DOCENTE_NO_DISPONIBLE);
            continue;
          }

          // 4c. Docentes libres en esos bloques (R5)
          if (
            docentesCurso.some((d) =>
              bloques.some((b) =>
                docentesOcupados.has(claveDocente(d.id_usuario, dia, b)),
              ),
            )
          ) {
            mejorEtapa = Math.max(mejorEtapa, Etapa.DOCENTE_OCUPADO);
            continue;
          }

          // 4d. Sala libre y con capacidad (R4)
          const sala = salas.find(
            (s) =>
              (!validarCapacidad || s.capacidad >= curso.inscritos) &&
              bloques.every(
                (b) => !salasOcupadas.has(claveSala(s.id_sala, dia, b)),
              ),
          );
          if (!sala) {
            mejorEtapa = Math.max(mejorEtapa, Etapa.SIN_SALA);
            continue;
          }

          elegida = {
            dia,
            bloque_inicio: bloques[0],
            bloque_fin: bloques[bloques.length - 1],
            id_sala: sala.id_sala,
            sala_nombre: sala.nombre,
          };

          // ---- Paso 5: registrar ocupación --------------------------------
          for (const b of bloques) {
            nivelSet.add(claveBloque(dia, b));
            salasOcupadas.add(claveSala(sala.id_sala, dia, b));
            for (const d of docentesCurso) {
              docentesOcupados.add(claveDocente(d.id_usuario, dia, b));
            }
          }
          diasUsados.add(dia);
          break;
        }
        if (elegida) break;
      }

      if (elegida) {
        sesiones.push(elegida);
      } else if (primeraFalla === null) {
        // ---- Paso 6: guardar por qué falló (la primera sesión que falla) --
        // Se siguen intentando las demás: una sesión de 1 bloque podría caber.
        primeraFalla = mejorEtapa;
      }
    }

    // ---- Paso 7: estado, motivo y advertencias -----------------------------
    const asignados = sesiones.reduce(
      (n, s) => n + s.bloque_fin - s.bloque_inicio + 1,
      0,
    );
    const estado: EstadoCursoGen =
      asignados >= curso.bloques_requeridos
        ? 'ASIGNADO'
        : asignados === 0
          ? 'NO_ASIGNADO'
          : 'PARCIAL';

    const motivo =
      estado === 'ASIGNADO' || primeraFalla === null
        ? null
        : motivoPorEtapa[primeraFalla];

    const advertencias: AdvertenciaCurso[] = [];
    if (docentesCurso.length === 0) advertencias.push('SIN_DOCENTE');
    if (curso.inscritos <= 0) advertencias.push('SIN_INSCRITOS');

    resultados.set(curso.id_curso, {
      id_curso: curso.id_curso,
      estado,
      sesiones,
      bloques_asignados: asignados,
      motivo,
      detalle_motivo: motivo
        ? detalleMotivo(motivo, curso, asignados, docentesCurso)
        : null,
      advertencias,
    });
  }

  // Se devuelve en el mismo orden en que llegaron los cursos
  return entrada.cursos.map((c) => resultados.get(c.id_curso)!);
}

// ---------------------------------------------------------------------------
// Texto del motivo (CA3: se informa el motivo, no se omite en silencio)
// ---------------------------------------------------------------------------

function detalleMotivo(
  motivo: MotivoNoAsignado,
  curso: CursoAGenerar,
  asignados: number,
  docentes: DocenteGen[],
): string {
  const avance = `Se asignaron ${asignados} de ${curso.bloques_requeridos} bloques.`;
  const nombres = docentes.map((d) => d.nombre).join(', ');

  switch (motivo) {
    case 'SIN_BLOQUES_LIBRES':
      return `${avance} No quedan pares de bloques libres en días distintos para el nivel ${curso.nivel} (bloques protegidos, asignaturas externas u otros cursos del nivel).`;
    case 'DOCENTE_SIN_DISPONIBILIDAD': {
      const sinDeclarar = docentes.filter(
        (d) => d.contrato === 'HORAS' && d.disponibilidad.size === 0,
      );
      if (sinDeclarar.length) {
        return `${avance} ${sinDeclarar.map((d) => d.nombre).join(', ')} (contrato por horas) no ha declarado disponibilidad.`;
      }
      return `${avance} La disponibilidad de ${nombres} no coincide con los bloques libres del nivel.`;
    }
    case 'DOCENTE_OCUPADO':
      return `${avance} ${nombres} ya tiene otros cursos en los bloques en que está disponible.`;
    case 'SIN_SALA_CON_CAPACIDAD':
      return `${avance} No hay sala de clases libre con capacidad para ${curso.inscritos} estudiantes en los bloques posibles.`;
  }
}
