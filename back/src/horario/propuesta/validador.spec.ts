import { Actividad, BloqueActividad, agruparActividades } from './actividades';
import { crucesDeSala } from './validador';

// Arma las actividades a partir de rangos, como las entrega el servicio
const clase = (
  id_curso: number,
  id_dia: number,
  inicio: number,
  fin: number,
  extra: Partial<BloqueActividad> = {},
): BloqueActividad[] =>
  Array.from({ length: fin - inicio + 1 }, (_, i) => ({
    origen: 'INTERNA',
    id_curso,
    codigo: `C${id_curso}`,
    nombre: `Curso ${id_curso}`,
    grupo: 'A',
    nivel: 2,
    id_plan: 2,
    codigo_carrera: '311',
    id_dia,
    dia: 'LUNES',
    id_bloque: inicio + i,
    id_sala: 1,
    sala: 'Sala 121',
    sala_externa: null,
    docentes: [{ id_usuario: 100 + id_curso, nombre: `Docente ${id_curso}` }],
    ...extra,
  }));

const actividades = (...bloques: BloqueActividad[][]): Actividad[] =>
  agruparActividades(bloques.flat());

describe('crucesDeSala (GEN-F03)', () => {
  it('sin cruces cuando cada sala tiene una clase por bloque', () => {
    const a = actividades(
      clase(1, 1, 1, 2),
      clase(2, 1, 3, 4),
      clase(3, 1, 1, 2, { id_sala: 2 }),
    );
    expect(crucesDeSala(a)).toEqual([]);
  });

  it('CA1 y CA3: señala ambas actividades con sala, día y bloques', () => {
    const a = actividades(clase(1, 1, 3, 4), clase(2, 1, 3, 4));
    const c = crucesDeSala(a);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      id_sala: 1,
      sala: 'Sala 121',
      id_dia: 1,
      bloque_inicio: 3,
      bloque_fin: 4,
    });
    expect(c[0].actividades.map((x) => x.codigo).sort()).toEqual(['C1', 'C2']);
    expect(c[0].mensaje).toBe(
      'Sala 121, Lunes bloques 3-4: C1 Curso 1 y C2 Curso 2',
    );
  });

  it('detecta el cruce parcial solo en el bloque compartido', () => {
    const c = crucesDeSala(actividades(clase(1, 1, 3, 4), clase(2, 1, 4, 5)));
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ bloque_inicio: 4, bloque_fin: 4 });
  });

  it('incluye los bloques de asignaturas externas en salas del departamento', () => {
    const externa = clase(9, 2, 7, 8, { origen: 'EXTERNA', docentes: [] });
    const c = crucesDeSala(actividades(externa, clase(1, 2, 8, 9)));
    expect(c).toHaveLength(1);
    expect(c[0].actividades.map((x) => x.origen).sort()).toEqual([
      'EXTERNA',
      'INTERNA',
    ]);
  });

  it('ignora las salas de otros departamentos', () => {
    const fuera = { id_sala: null, sala: null, sala_externa: 'Sala Educación' };
    expect(
      crucesDeSala(
        actividades(clase(1, 1, 1, 2, fuera), clase(2, 1, 1, 2, fuera)),
      ),
    ).toEqual([]);
  });
});
