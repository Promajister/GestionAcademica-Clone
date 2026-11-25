import { AlcanceBloqueProtegido, TipoContrato } from '@prisma/client';
import {
  CursoEntrada,
  EntradaGenerador,
  ProtegidoEntrada,
  dividirEnSesiones,
  generarPropuesta,
} from './generador';

const docente = (
  id_usuario: number,
  contrato: TipoContrato = TipoContrato.PLANTA,
  disponibilidad: string[] = [],
) => ({
  id_carga: id_usuario * 10,
  id_usuario,
  nombre: `Docente ${id_usuario}`,
  contrato,
  disponibilidad: new Set(disponibilidad),
});

const curso = (
  id: number,
  extra: Partial<CursoEntrada> = {},
): CursoEntrada => ({
  id_curso: id,
  codigo: `C${id}`,
  nombre: `Curso ${id}`,
  grupo: 'A',
  inscritos: 20,
  bloques: 4,
  nivel: 2,
  codigo_carrera: '311',
  cohorte: '2-2',
  docentes: [docente(100 + id)],
  ...extra,
});

const protegido = (
  id_dia: number,
  id_bloque: number,
  extra: Partial<ProtegidoEntrada> = {},
): ProtegidoEntrada => ({
  id_dia,
  id_bloque,
  nombre: 'Protegido',
  alcance: AlcanceBloqueProtegido.UNIVERSIDAD,
  codigo_carrera: null,
  semestre: null,
  contrato: null,
  id_usuario: null,
  ...extra,
});

const base = (extra: Partial<EntradaGenerador> = {}): EntradaGenerador => ({
  cursos: [],
  salas: [
    { id_sala: 1, nombre: 'Sala 121', capacidad: 22 },
    { id_sala: 2, nombre: 'Sala 104', capacidad: 22 },
  ],
  protegidos: [],
  externos: [],
  ...extra,
});

// Todos los bloques (día-bloque) de una sesión
const ocupados = (r: ReturnType<typeof generarPropuesta>, id_curso?: number) =>
  r.sesiones
    .filter((s) => id_curso == null || s.id_curso === id_curso)
    .flatMap((s) => s.bloques.map((b) => `${s.id_dia}-${b}`));

describe('generarPropuesta (GEN-F01)', () => {
  it('divide las horas en clases de 2 bloques', () => {
    expect(dividirEnSesiones(4)).toEqual([2, 2]);
    expect(dividirEnSesiones(5)).toEqual([2, 2, 1]);
  });

  it('asigna todos los bloques en días distintos y sin cruzar la colación', () => {
    const r = generarPropuesta(base({ cursos: [curso(1, { bloques: 6 })] }));
    expect(r.no_asignadas).toEqual([]);
    expect(r.sesiones).toHaveLength(3);
    expect(new Set(r.sesiones.map((s) => s.id_dia)).size).toBe(3);
    for (const s of r.sesiones) {
      expect(s.bloques[0] % 2).toBe(1);
      expect(
        s.bloques.every((b) => b <= 6) || s.bloques.every((b) => b >= 7),
      ).toBe(true);
    }
  });

  it('CA2: no ocupa bloques protegidos ni bloques de asignaturas externas', () => {
    const protegidos = [1, 2, 3, 4, 5].flatMap((d) =>
      [1, 2, 3, 4].map((b) => protegido(d, b)),
    );
    const externos = [1, 2, 3, 4, 5].flatMap((d) =>
      [5, 6].map((b) => ({
        id_dia: d,
        id_bloque: b,
        id_sala: null,
        cohorte: '2-2',
        codigo: 'EXT',
        grupo: 'A',
      })),
    );
    const r = generarPropuesta(
      base({ cursos: [curso(1)], protegidos, externos }),
    );
    expect(r.no_asignadas).toEqual([]);
    for (const k of ocupados(r)) {
      const b = Number(k.split('-')[1]);
      expect(b).toBeGreaterThanOrEqual(7);
    }
  });

  it('un externo en una sala del departamento la deja ocupada para otros niveles', () => {
    const externos = [1, 2, 3, 4, 5].flatMap((d) =>
      Array.from({ length: 12 }, (_, i) => ({
        id_dia: d,
        id_bloque: i + 1,
        id_sala: 1,
        cohorte: '9-9',
        codigo: 'EXT',
        grupo: 'A',
      })),
    );
    const r = generarPropuesta(base({ cursos: [curso(1)], externos }));
    expect(r.sesiones.every((s) => s.id_sala === 2)).toBe(true);
  });

  it('respeta los protegidos del nivel y del docente', () => {
    const lunesAJueves = [1, 2, 3, 4].flatMap((d) =>
      Array.from({ length: 12 }, (_, i) => i + 1).map((b) => [d, b]),
    );
    const protegidos = [
      ...lunesAJueves.map(([d, b]) =>
        protegido(d, b, {
          alcance: AlcanceBloqueProtegido.ESTUDIANTES,
          codigo_carrera: '311',
          semestre: 2,
        }),
      ),
    ];
    const r = generarPropuesta(
      base({ cursos: [curso(1, { bloques: 2 })], protegidos }),
    );
    expect(r.sesiones[0].id_dia).toBe(5);

    // Otro nivel no se ve afectado por ese protegido
    const r2 = generarPropuesta(
      base({
        cursos: [curso(2, { bloques: 2, nivel: 4, cohorte: '2-4' })],
        protegidos,
      }),
    );
    expect(r2.sesiones[0].id_dia).toBe(1);

    const individual = [1, 2, 3, 4, 5].flatMap((d) =>
      Array.from({ length: 12 }, (_, i) =>
        protegido(d, i + 1, {
          alcance: AlcanceBloqueProtegido.ACADEMICO_INDIVIDUAL,
          id_usuario: 101,
        }),
      ),
    );
    const r3 = generarPropuesta(
      base({ cursos: [curso(1)], protegidos: individual }),
    );
    expect(r3.no_asignadas[0].motivo).toBe('SIN_BLOQUE_LIBRE');
  });

  it('T3: usa una sala con capacidad suficiente e informa si no hay', () => {
    const salas = [
      { id_sala: 5, nombre: 'Núcleo', capacidad: 10 },
      { id_sala: 1, nombre: 'Sala 121', capacidad: 22 },
    ];
    const r = generarPropuesta(base({ salas, cursos: [curso(1)] }));
    expect(r.sesiones.every((s) => s.id_sala === 1)).toBe(true);

    const r2 = generarPropuesta(
      base({ salas, cursos: [curso(2, { inscritos: 30 })] }),
    );
    expect(r2.sesiones).toHaveLength(0);
    expect(r2.no_asignadas[0]).toMatchObject({
      motivo: 'SIN_SALA',
      bloques_asignados: 0,
    });
  });

  it('T4: un docente por horas solo recibe bloques de su disponibilidad', () => {
    const disponibilidad = ['2-7', '2-8', '4-3', '4-4'];
    const r = generarPropuesta(
      base({
        cursos: [
          curso(1, {
            docentes: [docente(50, TipoContrato.HORAS, disponibilidad)],
          }),
        ],
      }),
    );
    expect(r.no_asignadas).toEqual([]);
    expect(ocupados(r).sort()).toEqual([...disponibilidad].sort());
  });

  it('CA3: informa el motivo en vez de omitir la asignatura', () => {
    const r = generarPropuesta(
      base({
        cursos: [
          curso(1, { docentes: [] }),
          curso(2, { bloques: 0 }),
          curso(3, { docentes: [docente(60, TipoContrato.HORAS, [])] }),
          curso(4, {
            docentes: [docente(61, TipoContrato.HORAS, ['1-1', '1-2'])],
          }),
        ],
      }),
    );
    const motivos = Object.fromEntries(
      r.no_asignadas.map((n) => [n.id_curso, n]),
    );
    expect(motivos[1].motivo).toBe('SIN_CARGA');
    expect(motivos[2].motivo).toBe('SIN_BLOQUES');
    expect(motivos[3].motivo).toBe('SIN_DISPONIBILIDAD');
    // Curso 4: cabe una clase de 2 bloques; la otra no tiene disponibilidad
    expect(motivos[4]).toMatchObject({
      motivo: 'SIN_DISPONIBILIDAD',
      bloques_asignados: 2,
      bloques_requeridos: 4,
    });
  });

  it('no deja cruces de sala, docente ni nivel entre cursos', () => {
    const cursos = Array.from({ length: 12 }, (_, i) =>
      curso(i + 1, {
        bloques: 6,
        cohorte: `1-${(i % 3) + 1}`,
        docentes: [docente(200 + (i % 4))],
      }),
    );
    const r = generarPropuesta(base({ cursos }));
    const sala = new Set<string>();
    const doc = new Set<string>();
    const coh = new Set<string>();
    for (const s of r.sesiones) {
      const c = cursos.find((x) => x.id_curso === s.id_curso)!;
      for (const b of s.bloques) {
        const ks = `${s.id_sala}-${s.id_dia}-${b}`;
        const kd = `${c.docentes[0].id_usuario}-${s.id_dia}-${b}`;
        const kc = `${c.cohorte}-${s.id_dia}-${b}`;
        expect(sala.has(ks) || doc.has(kd) || coh.has(kc)).toBe(false);
        sala.add(ks);
        doc.add(kd);
        coh.add(kc);
      }
    }
    expect(r.no_asignadas).toEqual([]);
  });

  describe('grupos de una misma asignatura', () => {
    // Solo queda libre el lunes, bloques 1-2: así se ve si dos clases pueden ir a la misma hora
    const soloLunesB1B2 = [1, 2, 3, 4, 5].flatMap((d) =>
      Array.from({ length: 12 }, (_, i) => i + 1)
        .filter((b) => !(d === 1 && b <= 2))
        .map((b) => protegido(d, b)),
    );
    const clase = (
      id: number,
      codigo: string,
      grupo: string,
      id_docente: number,
    ) =>
      curso(id, { codigo, grupo, bloques: 2, docentes: [docente(id_docente)] });

    it('dos grupos distintos de la misma asignatura pueden ir a la misma hora', () => {
      const r = generarPropuesta(
        base({
          cursos: [clase(1, 'HIS', 'A', 301), clase(2, 'HIS', 'B', 302)],
          protegidos: soloLunesB1B2,
        }),
      );
      expect(r.no_asignadas).toEqual([]);
      expect(ocupados(r, 1)).toEqual(['1-1', '1-2']);
      expect(ocupados(r, 2)).toEqual(['1-1', '1-2']);
      // Cada grupo en su propia sala
      expect(new Set(r.sesiones.map((x) => x.id_sala)).size).toBe(2);
    });

    it('el mismo grupo (por ejemplo su cátedra y su taller) no puede ir a la misma hora', () => {
      const r = generarPropuesta(
        base({
          cursos: [clase(1, 'HIS', 'A', 301), clase(2, 'HIS', 'A', 302)],
          protegidos: soloLunesB1B2,
        }),
      );
      expect(r.no_asignadas).toHaveLength(1);
      expect(r.no_asignadas[0].motivo).toBe('SIN_BLOQUE_LIBRE');
    });

    it('asignaturas distintas del mismo nivel siguen chocando aunque sean de otro grupo', () => {
      const r = generarPropuesta(
        base({
          cursos: [clase(1, 'HIS', 'A', 301), clase(2, 'GEO', 'B', 302)],
          protegidos: soloLunesB1B2,
        }),
      );
      expect(r.no_asignadas).toHaveLength(1);
    });

    it('un mismo docente no puede dictar dos grupos a la vez', () => {
      const r = generarPropuesta(
        base({
          cursos: [clase(1, 'HIS', 'A', 301), clase(2, 'HIS', 'B', 301)],
          protegidos: soloLunesB1B2,
        }),
      );
      expect(r.no_asignadas).toHaveLength(1);
    });

    it('un bloque externo de otro grupo de la misma asignatura no ocupa al nivel', () => {
      const externos = [1, 2].map((b) => ({
        id_dia: 1,
        id_bloque: b,
        id_sala: null,
        cohorte: '2-2',
        codigo: 'HIS',
        grupo: 'B',
      }));
      const r = generarPropuesta(
        base({
          cursos: [clase(1, 'HIS', 'A', 301)],
          protegidos: soloLunesB1B2,
          externos,
        }),
      );
      expect(r.no_asignadas).toEqual([]);
      expect(ocupados(r, 1)).toEqual(['1-1', '1-2']);
    });
  });
});
