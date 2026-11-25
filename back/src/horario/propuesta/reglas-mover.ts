import { BloqueActividad, OrigenActividad } from './actividades';

// GEN-F02: reglas al mover una clase a un bloque donde ya hay otras clases.
// Se puede mover sobre clases de otro semestre en otra sala; no se puede:
//  - a una sala ocupada (de cualquier semestre)
//  - junto a otra clase del mismo semestre (mismo plan y nivel), salvo otro grupo de la misma asignatura
// El cruce de docente no impide mover: se avisa y bloquea el cierre.
export interface Destino {
  id_dia: number;
  id_sala: number | null;
  bloques: number[];
}

export function choqueAlMover(
  bloques: BloqueActividad[],
  origen: OrigenActividad,
  id_curso: number,
  hacia: Destino,
): string | null {
  const esLaClase = (b: BloqueActividad) =>
    b.origen === origen && b.id_curso === id_curso;
  const clase = bloques.find(esLaClase);
  const otros = bloques
    .filter(
      (b) =>
        !esLaClase(b) &&
        b.id_dia === hacia.id_dia &&
        hacia.bloques.includes(b.id_bloque),
    )
    .sort((x, y) => x.id_bloque - y.id_bloque);

  const enSala =
    hacia.id_sala != null && otros.find((b) => b.id_sala === hacia.id_sala);
  if (enSala) {
    return `No se puede mover: ${enSala.sala ?? 'la sala'} ya está ocupada por ${enSala.codigo} ${enSala.nombre} (${enSala.dia} bloque ${enSala.id_bloque})`;
  }

  if (!clase || clase.id_plan == null) return null;
  const mismoSemestre = otros.find(
    (b) =>
      b.id_plan === clase.id_plan &&
      b.nivel === clase.nivel &&
      !(b.codigo === clase.codigo && b.grupo !== clase.grupo),
  );
  if (mismoSemestre) {
    return `No se puede mover: choca con ${mismoSemestre.codigo} ${mismoSemestre.nombre}, del mismo semestre (${mismoSemestre.dia} bloque ${mismoSemestre.id_bloque})`;
  }
  return null;
}
