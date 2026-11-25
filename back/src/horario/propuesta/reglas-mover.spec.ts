import { BloqueActividad } from './actividades';
import { choqueAlMover } from './reglas-mover';

// Bloques de una clase, como los entrega el servicio
const clase = (
  id_curso: number,
  id_dia: number,
  bloques: number[],
  extra: Partial<BloqueActividad> = {},
): BloqueActividad[] =>
  bloques.map((b) => ({
    origen: 'INTERNA',
    id_curso,
    codigo: `C${id_curso}`,
    nombre: `Curso ${id_curso}`,
    grupo: 'A',
    nivel: 2,
    id_plan: 2,
    codigo_carrera: '311',
    id_dia,
    dia: 'MARTES',
    id_bloque: b,
    id_sala: 1,
    sala: 'Sala 121',
    sala_externa: null,
    docentes: [{ id_usuario: 100 + id_curso, nombre: `Docente ${id_curso}` }],
    ...extra,
  }));

// La clase 1 (lunes B1-2, Sala 121, semestre 2) se mueve al martes B3-4
const mover = (otros: BloqueActividad[][], id_sala: number | null = 1) =>
  choqueAlMover(
    [...clase(1, 1, [1, 2], { dia: 'LUNES' }), ...otros.flat()],
    'INTERNA',
    1,
    { id_dia: 2, id_sala, bloques: [3, 4] },
  );

describe('choqueAlMover (GEN-F02)', () => {
  it('se mueve a un bloque libre', () => {
    expect(mover([])).toBeNull();
  });

  it('se mueve sobre una clase de otro semestre en otra sala', () => {
    expect(
      mover([clase(2, 2, [3, 4], { nivel: 4, id_sala: 2, sala: 'Sala 104' })]),
    ).toBeNull();
  });

  it('no se mueve a una sala ocupada, aunque la otra clase sea de otro semestre', () => {
    expect(mover([clase(2, 2, [4, 5], { nivel: 4 })])).toBe(
      'No se puede mover: Sala 121 ya está ocupada por C2 Curso 2 (MARTES bloque 4)',
    );
  });

  it('no se mueve junto a otra clase del mismo semestre, aunque esté en otra sala', () => {
    expect(mover([clase(2, 2, [3, 4], { id_sala: 2, sala: 'Sala 104' })])).toBe(
      'No se puede mover: choca con C2 Curso 2, del mismo semestre (MARTES bloque 3)',
    );
  });

  it('una externa del mismo semestre en sala de otro departamento también choca', () => {
    const externa = clase(9, 2, [3], {
      origen: 'EXTERNA',
      id_sala: null,
      sala: null,
      sala_externa: 'Sala Educación',
      docentes: [],
    });
    expect(mover([externa])).toMatch(/del mismo semestre/);
  });

  it('otro grupo de la misma asignatura puede ir a la misma hora (en otra sala)', () => {
    const otroGrupo = clase(2, 2, [3, 4], {
      codigo: 'C1',
      nombre: 'Curso 1',
      grupo: 'B',
      id_sala: 2,
      sala: 'Sala 104',
    });
    expect(mover([otroGrupo])).toBeNull();
  });

  it('el mismo semestre de otro plan no choca', () => {
    expect(
      mover([
        clase(2, 2, [3, 4], { id_plan: 1, id_sala: 2, sala: 'Sala 104' }),
      ]),
    ).toBeNull();
  });

  it('el mismo docente no impide mover (se avisa como cruce)', () => {
    const mismoDocente = clase(2, 2, [3, 4], {
      nivel: 4,
      id_sala: 2,
      sala: 'Sala 104',
      docentes: [{ id_usuario: 101, nombre: 'Docente 1' }],
    });
    expect(mover([mismoDocente])).toBeNull();
  });

  it('sus propios bloques no cuentan como choque (correrla un bloque)', () => {
    expect(
      choqueAlMover(clase(1, 2, [2, 3], { dia: 'MARTES' }), 'INTERNA', 1, {
        id_dia: 2,
        id_sala: 1,
        bloques: [3, 4],
      }),
    ).toBeNull();
  });
});
