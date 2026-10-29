import { Prisma, TipoContrato, TipoDia } from '@prisma/client';

type Db = Prisma.TransactionClient;

export const hoyUtc = () => {
  const ahora = new Date();
  return new Date(
    Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()),
  );
};

export const formatoFecha = (fecha: Date) => fecha.toISOString().slice(0, 10);

export async function choqueConOcupaciones(
  db: Db,
  p: {
    id_sala: number;
    id_dia?: number;
    diaNombre?: TipoDia;
    bloque_numero: number;
    fecha?: Date;
    excluirCursoId?: number;
  },
): Promise<string | null> {
  const sala = await db.sala.findUnique({ where: { id_sala: p.id_sala } });
  const nombreSala = sala?.nombre ?? `Sala ${p.id_sala}`;

  // 1. Choque con Horario (clases internas con carga docente)
  if (p.id_dia) {
    const horario = await db.horario.findFirst({
      where: {
        id_sala: p.id_sala,
        id_dia: p.id_dia,
        id_bloque: p.bloque_numero,
        ...(p.excluirCursoId && {
          carga: { id_curso: { not: p.excluirCursoId } },
        }),
      },
      include: {
        carga: {
          include: {
            curso: { include: { asignatura: true } },
          },
        },
        dia: true,
      },
    });

    if (horario) {
      const codigo = horario.carga.curso.asignatura.codigo;
      const diaTexto = horario.dia.nombre;
      return `La ${nombreSala} ya está ocupada por ${codigo} el ${diaTexto} bloque ${p.bloque_numero}`;
    }
  }

  // 2. Choque con HorarioExterno (asignaturas externas)
  if (p.id_dia) {
    const externo = await db.horarioExterno.findFirst({
      where: {
        id_sala: p.id_sala,
        id_dia: p.id_dia,
        id_bloque: p.bloque_numero,
        ...(p.excluirCursoId && {
          id_curso: { not: p.excluirCursoId },
        }),
      },
      include: {
        curso: { include: { asignatura: true } },
        dia: true,
      },
    });

    if (externo) {
      const codigo = externo.curso.asignatura.codigo;
      const diaTexto = externo.dia.nombre;
      return `La ${nombreSala} ya está ocupada por ${codigo} el ${diaTexto} bloque ${p.bloque_numero}`;
    }
  }

  // 3. Choque con OcupacionPuntual
  const puntual = await db.ocupacionPuntual.findFirst({
    where: {
      id_sala: p.id_sala,
      id_bloque: p.bloque_numero,
      ...(p.fecha && { fecha: p.fecha }),
    },
  });

  if (puntual) {
    const fechaTexto = formatoFecha(puntual.fecha);
    return `La ${nombreSala} tiene una ocupación puntual el día ${fechaTexto} bloque ${p.bloque_numero}`;
  }

  return null;
}

export async function choqueConBloqueProtegido(
  db: Db,
  p: {
    id_dia: number;
    bloques: number[];
    codigo_carrera?: string;
    semestre?: number;
    id_usuario?: number;
  },
) {
  if (!p.bloques || p.bloques.length === 0) {
    return [];
  }

  let contratoProfesor: TipoContrato | null = null;
  if (p.id_usuario) {
    const prof = await db.profesor.findUnique({
      where: { id_usuario: p.id_usuario },
      select: { contrato: true },
    });
    if (prof) {
      contratoProfesor = prof.contrato;
    }
  }

  const condicionesAlcance: Prisma.BloqueProtegidoWhereInput[] = [];

  // Si se busca por grupo (carrera / semestre) o no se especifica usuario
  if (p.codigo_carrera || (!p.codigo_carrera && !p.id_usuario)) {
    condicionesAlcance.push({ alcance: 'UNIVERSIDAD' });
    condicionesAlcance.push({ alcance: 'FACULTAD' });
  }

  if (p.codigo_carrera) {
    condicionesAlcance.push({
      alcance: 'CARRERA',
      codigo_carrera: p.codigo_carrera,
    });
    if (p.semestre !== undefined && p.semestre !== null) {
      condicionesAlcance.push({
        alcance: { in: ['ESTUDIANTES', 'PRACTICA_PREPRACTICA'] },
        codigo_carrera: p.codigo_carrera,
        semestre: p.semestre,
      });
    }
  }

  if (p.id_usuario) {
    condicionesAlcance.push({
      alcance: 'ACADEMICO_INDIVIDUAL',
      id_usuario: p.id_usuario,
    });
    if (contratoProfesor) {
      condicionesAlcance.push({
        alcance: 'ACADEMICOS',
        OR: [{ contrato: null }, { contrato: contratoProfesor }],
      });
    } else {
      condicionesAlcance.push({
        alcance: 'ACADEMICOS',
      });
    }
  }

  if (condicionesAlcance.length === 0) {
    return [];
  }

  return db.bloqueProtegido.findMany({
    where: {
      id_dia: p.id_dia,
      id_bloque: { in: p.bloques },
      OR: condicionesAlcance,
    },
    include: {
      dia: true,
      bloque: true,
      carrera: true,
      profesor: {
        include: { usuario: true },
      },
    },
    orderBy: [{ id_dia: 'asc' }, { id_bloque: 'asc' }],
  });
}
