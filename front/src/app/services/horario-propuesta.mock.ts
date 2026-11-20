// TODO(HOR-65): eliminar este mock cuando exista POST /horario/propuestas/generar.
//
// Generador SIMPLIFICADO, solo para probar la interfaz sin back. No reemplaza al
// servicio de generación: no conoce la ocupación de salas de otros niveles, ni
// la carga docente real, ni la disponibilidad de los docentes.
//
// Reglas que sí respeta:
//  - Un curso por cada tipo (cátedra / taller / laboratorio) con horas > 0.
//  - Bloques en pares alineados (1-2, 3-4, 5-6, 7-8, 9-10, 11-12); un curso de 4
//    bloques recibe 2 pares en días distintos.
//  - No usa bloques protegidos ni bloques de asignaturas externas (que no se tocan).
//  - Una sala no se usa dos veces en el mismo día y bloque.
//  - Los cursos de un mismo nivel no se superponen.
import {
  AsignaturaDTO,
  BloqueProtegidoDTO,
  CursoPropuestaDTO,
  DiaSemana,
  DocentePropuestaDTO,
  MotivoNoAsignado,
  PropuestaHorarioDTO,
  SesionPropuestaDTO,
  TipoCurso,
} from './horario-api.service';
import { SalaDTO } from './salas-api.service';

const DIAS: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];

// Pares válidos: el primer bloque siempre es impar
const PARES: [number, number][] = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 12],
];

const DOCENTE_DEMO: DocentePropuestaDTO = {
  id_usuario: -1,
  nombre: 'Docente de planta',
  contrato: 'PLANTA',
};

const SALA_DEMO: SalaDTO = {
  id_sala: -1,
  nombre: 'Sala 101',
  capacidad: 60,
  tipo: 'CLASES',
  activo: true,
};

const k = (dia: DiaSemana, bloque: number) => `${dia}-${bloque}`;

export interface MockPropuestaInput {
  codigo_carrera: string;
  id_plan: number;
  semestre: number;
  asignaturas: AsignaturaDTO[];
  protegidos: BloqueProtegidoDTO[];
  salas: SalaDTO[];
}

export function generarPropuestaMock(input: MockPropuestaInput): PropuestaHorarioDTO {
  // Bloques del nivel ya ocupados (protegidos + externas)
  const ocupadoNivel = new Set<string>();
  // Ocupación de salas: id_sala-dia-bloque
  const ocupadoSala = new Set<string>();

  for (const bp of input.protegidos) {
    const bloques =
      bp.bloques && bp.bloques.length > 0
        ? bp.bloques
        : Array.from(
            { length: bp.bloque_fin - bp.bloque_inicio + 1 },
            (_, i) => bp.bloque_inicio + i,
          );
    for (const b of bloques) ocupadoNivel.add(k(bp.dia, b));
  }

  const externas = input.asignaturas.filter((a) => a.origen === 'EXTERNA');
  for (const a of externas) {
    for (const c of a.cursos ?? []) {
      for (const bh of c.bloques_horarios ?? []) {
        ocupadoNivel.add(k(bh.dia, bh.bloque_numero));
        if (bh.id_sala != null) ocupadoSala.add(`${bh.id_sala}-${bh.dia}-${bh.bloque_numero}`);
      }
    }
  }

  const salas = input.salas.filter((s) => s.activo && s.tipo === 'CLASES');
  const salasDisponibles = salas.length > 0 ? salas : [SALA_DEMO];
  // Probar primero las salas más chicas que cumplan (no desperdiciar salas grandes)
  salasDisponibles.sort((a, b) => a.capacidad - b.capacidad);

  const propias = input.asignaturas.filter(
    (a) => a.origen === 'PROPIA' || a.origen === 'INTERNA',
  );

  const cursos: CursoPropuestaDTO[] = [];
  let indiceCurso = 0;

  for (const asig of propias) {
    const tipos: [TipoCurso, number][] = [
      ['CATEDRA', asig.catedraSemanal ?? 0],
      ['TALLER', asig.tallerSemanal ?? 0],
      ['LABORATORIO', asig.labSemanal ?? 0],
    ];

    for (const [tipo, bloquesRequeridos] of tipos) {
      if (!bloquesRequeridos || bloquesRequeridos <= 0) continue;

      const existente = (asig.cursos ?? []).find(
        (c) => (c.tipo ?? '').toUpperCase() === tipo,
      );
      const inscritos = asig.cupo > 0 ? asig.cupo : null;
      // En el mock, uno de cada tres cursos queda sin docente para ver la advertencia
      const docentes = indiceCurso % 3 === 2 ? [] : [DOCENTE_DEMO];

      // Sesiones de 2 bloques; si la cantidad es impar, la última es de 1 bloque
      const largos: number[] = [];
      for (let r = bloquesRequeridos; r > 0; r -= 2) largos.push(Math.min(2, r));

      const sesiones: SesionPropuestaDTO[] = [];
      const diasUsados = new Set<DiaSemana>();
      let motivo: MotivoNoAsignado | null = null;

      for (const largo of largos) {
        let colocada: SesionPropuestaDTO | null = null;
        let habiaBloquesLibres = false;

        // Repartir el inicio de la búsqueda entre días para no cargar solo el lunes
        for (let d = 0; d < DIAS.length && !colocada; d++) {
          const dia = DIAS[(indiceCurso + d) % DIAS.length];
          if (diasUsados.has(dia)) continue;

          for (const [b1, b2] of PARES) {
            const bloques = largo === 2 ? [b1, b2] : [b1];
            if (bloques.some((b) => ocupadoNivel.has(k(dia, b)))) continue;
            habiaBloquesLibres = true;

            const sala = salasDisponibles.find(
              (s) =>
                (inscritos == null || s.capacidad >= inscritos) &&
                bloques.every((b) => !ocupadoSala.has(`${s.id_sala}-${dia}-${b}`)),
            );
            if (!sala) continue;

            colocada = {
              dia,
              bloque_inicio: bloques[0],
              bloque_fin: bloques[bloques.length - 1],
              id_sala: sala.id_sala,
              sala_nombre: sala.nombre,
            };
            for (const b of bloques) {
              ocupadoNivel.add(k(dia, b));
              ocupadoSala.add(`${sala.id_sala}-${dia}-${b}`);
            }
            diasUsados.add(dia);
            break;
          }
        }

        if (colocada) {
          sesiones.push(colocada);
        } else {
          motivo = habiaBloquesLibres ? 'SIN_SALA_CON_CAPACIDAD' : 'SIN_BLOQUES_LIBRES';
          break;
        }
      }

      const asignados = sesiones.reduce(
        (acc, s) => acc + (s.bloque_fin - s.bloque_inicio + 1),
        0,
      );
      const estado =
        asignados >= bloquesRequeridos
          ? 'ASIGNADO'
          : asignados === 0
            ? 'NO_ASIGNADO'
            : 'PARCIAL';

      const advertencias: CursoPropuestaDTO['advertencias'] = [];
      if (docentes.length === 0) advertencias.push('SIN_DOCENTE');
      if (inscritos == null) advertencias.push('SIN_INSCRITOS');

      cursos.push({
        id_curso: existente?.id_curso ?? null,
        curso_nuevo: !existente,
        tipo,
        grupo: '1',
        codigo_asignatura: asig.codigo,
        nombre_asignatura: asig.nombre,
        bloques_requeridos: bloquesRequeridos,
        inscritos,
        docentes,
        sesiones,
        estado,
        motivo: estado === 'ASIGNADO' ? null : motivo,
        detalle_motivo:
          estado === 'ASIGNADO'
            ? null
            : motivo === 'SIN_SALA_CON_CAPACIDAD'
              ? `Se asignaron ${asignados} de ${bloquesRequeridos} bloques: no hay sala libre para ${inscritos ?? '?'} estudiantes en los pares de bloques libres.`
              : `Se asignaron ${asignados} de ${bloquesRequeridos} bloques: no quedan pares de bloques libres en días distintos (bloques protegidos, asignaturas externas u otros cursos del nivel).`,
        advertencias,
      });
      indiceCurso++;
    }
  }

  return {
    id_propuesta: null,
    generada_en: new Date().toISOString(),
    codigo_carrera: input.codigo_carrera,
    id_plan: input.id_plan,
    semestre: input.semestre,
    cursos,
    resumen: {
      total_cursos: cursos.length,
      asignados: cursos.filter((c) => c.estado === 'ASIGNADO').length,
      parciales: cursos.filter((c) => c.estado === 'PARCIAL').length,
      no_asignados: cursos.filter((c) => c.estado === 'NO_ASIGNADO').length,
      cursos_nuevos: cursos.filter((c) => c.curso_nuevo).length,
      sin_docente: cursos.filter((c) => c.advertencias.includes('SIN_DOCENTE')).length,
    },
  };
}
