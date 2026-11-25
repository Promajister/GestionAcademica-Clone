import { AlcanceBloqueProtegido, TipoContrato } from '@prisma/client';
import { Actividad, BloqueActividad, agruparActividades } from './actividades';
import { ProtegidoEntrada } from './generador';
import {
  crucesConProtegidos,
  crucesDeDocente,
  crucesDeSala,
} from './validador';

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

describe('crucesDeDocente (GEN-F04)', () => {
  const profe = { docentes: [{ id_usuario: 7, nombre: 'Ana Pérez' }] };

  it('CA1 y CA2: identifica al docente y las dos actividades, aunque estén en salas distintas', () => {
    const a = actividades(
      clase(1, 3, 5, 6, profe),
      clase(2, 3, 5, 6, { ...profe, id_sala: 2, sala: 'Sala 104' }),
    );
    const c = crucesDeDocente(a);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      id_usuario: 7,
      docente: 'Ana Pérez',
      id_dia: 3,
      bloque_inicio: 5,
      bloque_fin: 6,
    });
    expect(c[0].mensaje).toBe(
      'Ana Pérez, Miércoles bloques 5-6: C1 Curso 1 (Sala 121) y C2 Curso 2 (Sala 104)',
    );
    // No es cruce de sala: cada clase tiene su sala
    expect(crucesDeSala(a)).toEqual([]);
  });

  it('sin cruce cuando el docente hace clases en bloques distintos', () => {
    const a = actividades(
      clase(1, 3, 5, 6, profe),
      clase(2, 3, 7, 8, { ...profe, id_sala: 2 }),
    );
    expect(crucesDeDocente(a)).toEqual([]);
  });

  it('dos docentes de un mismo curso no generan cruce entre ellos', () => {
    const coDocencia = {
      docentes: [
        { id_usuario: 7, nombre: 'Ana Pérez' },
        { id_usuario: 8, nombre: 'Luis Soto' },
      ],
    };
    expect(crucesDeDocente(actividades(clase(1, 1, 1, 2, coDocencia)))).toEqual(
      [],
    );
  });
});

describe('grupos en los mensajes de cruce', () => {
  it('dos grupos de la misma asignatura se distinguen por su grupo', () => {
    const profe = { docentes: [{ id_usuario: 7, nombre: 'Ana Pérez' }] };
    const a = actividades(
      clase(1, 1, 1, 2, { ...profe, codigo: 'HIS', nombre: 'Historia' }),
      clase(2, 1, 1, 2, {
        ...profe,
        codigo: 'HIS',
        nombre: 'Historia',
        grupo: 'B',
        id_sala: 2,
        sala: 'Sala 104',
      }),
    );
    expect(crucesDeDocente(a)[0].mensaje).toBe(
      'Ana Pérez, Lunes bloques 1-2: HIS Historia (grupo A) (Sala 121) y HIS Historia (grupo B) (Sala 104)',
    );
  });
});

describe('crucesConProtegidos', () => {
  const protegido = (
    id_dia: number,
    id_bloque: number,
    extra: Partial<ProtegidoEntrada> = {},
  ): ProtegidoEntrada => ({
    id_dia,
    id_bloque,
    nombre: 'Consejo',
    alcance: AlcanceBloqueProtegido.UNIVERSIDAD,
    codigo_carrera: null,
    semestre: null,
    contrato: null,
    id_usuario: null,
    ...extra,
  });

  it('informa la clase que quedó dentro de un bloque protegido', () => {
    const a = actividades(clase(1, 1, 1, 2), clase(2, 1, 3, 4));
    const c = crucesConProtegidos(a, [protegido(1, 2), protegido(1, 5)]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      protegido: 'Consejo',
      bloque_inicio: 2,
      bloque_fin: 2,
    });
    expect(c[0].mensaje).toBe(
      'C1 Curso 1, Lunes bloque 2: está en el bloque protegido «Consejo»',
    );
  });

  it('solo cuenta los protegidos que alcanzan a la clase', () => {
    const a = actividades(
      clase(1, 1, 1, 2, {
        docentes: [
          { id_usuario: 7, nombre: 'Ana', contrato: TipoContrato.PLANTA },
        ],
      }),
    );
    // Estudiantes de otro semestre: no la alcanza
    const otroNivel = protegido(1, 1, {
      alcance: AlcanceBloqueProtegido.ESTUDIANTES,
      codigo_carrera: '311',
      semestre: 4,
    });
    // Académicos por horas: su docente es de planta
    const porHoras = protegido(1, 2, {
      alcance: AlcanceBloqueProtegido.ACADEMICOS,
      contrato: TipoContrato.HORAS,
    });
    expect(crucesConProtegidos(a, [otroNivel, porHoras])).toEqual([]);
    // Académicos de planta: sí
    const planta = protegido(1, 2, {
      alcance: AlcanceBloqueProtegido.ACADEMICOS,
      contrato: TipoContrato.PLANTA,
    });
    expect(crucesConProtegidos(a, [planta])).toHaveLength(1);
  });
});
