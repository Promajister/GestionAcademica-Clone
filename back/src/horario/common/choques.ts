import { DiaSemana, Prisma, TipoOcupacion } from '@prisma/client';

type Db = Prisma.TransactionClient;

// Fecha de hoy como medianoche UTC, igual que se guardan los campos @db.Date
export const hoyUtc = () => {
  const ahora = new Date();
  return new Date(
    Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()),
  );
};

export const formatoFecha = (fecha: Date) => fecha.toISOString().slice(0, 10);

// Busca una ocupación de sala que se cruce con [inicio, fin] ese día.
// - Sin `fecha` (uso semanal): choca con ocupaciones SEMESTRALES y con
//   reservas PUNTUALES futuras de ese mismo día de la semana.
// - Con `fecha` (reserva puntual): choca con SEMESTRALES y con PUNTUALES de esa fecha.
// Devuelve un mensaje para el usuario, o null si la sala está libre.
export async function choqueConOcupaciones(
  db: Db,
  p: {
    id_sala: number;
    dia: DiaSemana;
    inicio: number;
    fin: number;
    fecha?: Date;
    excluirId?: number;
  },
): Promise<string | null> {
  const ocupacion = await db.ocupacion_sala.findFirst({
    where: {
      id_sala: p.id_sala,
      dia: p.dia,
      bloque_inicio: { lte: p.fin },
      bloque_fin: { gte: p.inicio },
      ...(p.excluirId !== undefined && {
        NOT: { id_ocupacion: p.excluirId },
      }),
      OR: [
        { tipo: TipoOcupacion.SEMESTRAL },
        {
          tipo: TipoOcupacion.PUNTUAL,
          fecha: p.fecha ?? { gte: hoyUtc() },
        },
      ],
    },
    include: { sala: true },
    orderBy: { fecha: 'asc' },
  });
  if (!ocupacion) return null;

  const cuando =
    ocupacion.tipo === TipoOcupacion.SEMESTRAL
      ? `todos los ${ocupacion.dia} durante el semestre`
      : `el ${formatoFecha(ocupacion.fecha!)}`;
  return `La ${ocupacion.sala.nombre} está ocupada por ${ocupacion.solicitante} (${ocupacion.motivo}) ${cuando}, de ${ocupacion.hora_inicio} a ${ocupacion.hora_fin}`;
}
