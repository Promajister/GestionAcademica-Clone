// Grilla pedagógica de la UTA: 12 bloques de 45 min de lunes a viernes.
// Las clases suelen ocupar 2 bloques seguidos. Pausas de 10 min en la mañana y
// de 5 min en la tarde; colación entre el bloque 6 (12:50) y el 7 (14:45).
export const BLOQUES_PEDAGOGICOS = [
  { numero: 1, hora_inicio: '08:00', hora_fin: '08:45', jornada: 'MANANA' },
  { numero: 2, hora_inicio: '08:45', hora_fin: '09:30', jornada: 'MANANA' },
  { numero: 3, hora_inicio: '09:40', hora_fin: '10:25', jornada: 'MANANA' },
  { numero: 4, hora_inicio: '10:25', hora_fin: '11:10', jornada: 'MANANA' },
  { numero: 5, hora_inicio: '11:20', hora_fin: '12:05', jornada: 'MANANA' },
  { numero: 6, hora_inicio: '12:05', hora_fin: '12:50', jornada: 'MANANA' },
  { numero: 7, hora_inicio: '14:45', hora_fin: '15:30', jornada: 'TARDE' },
  { numero: 8, hora_inicio: '15:30', hora_fin: '16:15', jornada: 'TARDE' },
  { numero: 9, hora_inicio: '16:20', hora_fin: '17:05', jornada: 'TARDE' },
  { numero: 10, hora_inicio: '17:05', hora_fin: '17:50', jornada: 'TARDE' },
  { numero: 11, hora_inicio: '17:55', hora_fin: '18:40', jornada: 'TARDE' },
  { numero: 12, hora_inicio: '18:40', hora_fin: '19:25', jornada: 'TARDE' },
] as const;

export const TOTAL_BLOQUES = BLOQUES_PEDAGOGICOS.length;

export type BloquePedagogico = (typeof BLOQUES_PEDAGOGICOS)[number];

export const bloquePorNumero = (numero: number): BloquePedagogico =>
  BLOQUES_PEDAGOGICOS[numero - 1];

// Números de bloque de un rango inclusivo, ej. (3, 4) -> [3, 4]
export const rangoBloques = (inicio: number, fin: number): number[] =>
  Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);

// Un rango válido no cruza la colación (no mezcla mañana y tarde)
export const mismaJornada = (inicio: number, fin: number): boolean =>
  bloquePorNumero(inicio).jornada === bloquePorNumero(fin).jornada;
