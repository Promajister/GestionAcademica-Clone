function normalizeText(s: string): string {
  return (s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); 
}

type ScoreMax = { score: number; max: number; excluded: boolean };

export function scoreFromAlternativa(rawDescripcion: string): ScoreMax {
  const d = normalizeText(rawDescripcion);

  // 1) Excluidas (se mantienen)
  if (d === 'na' || d === 'n/a') return { score: 0, max: 0, excluded: true };
  if (d.includes('no existe') || d.includes('no sabe')) {
    return { score: 0, max: 0, excluded: true };
  }

  // 2) Likert 1..5 -> 0..4 (max 4)
  if (/^[1-5]$/.test(d)) {
    const n = Number(d);     
    return { score: n - 1, max: 4, excluded: false };
  }

  // 3) Sí/No (max 1)
  if (d === 'si') return { score: 1, max: 1, excluded: false };
  if (d === 'no') return { score: 0, max: 1, excluded: false };

  // 4) Participación (max 4)
  if (d.includes('asisti') && d.includes('pude') && d.includes('participar')) {
    return { score: 4, max: 4, excluded: false };
  }
  if (d.includes('asisti') && (d.includes('no intervine') || d.includes('pero no intervine'))) {
    return { score: 3, max: 4, excluded: false };
  }
  if (d.includes('se realizo') && d.includes('no asisti')) {
    return { score: 2, max: 4, excluded: false };
  }
  if (d.includes('se realizo') && d.includes('no fui invitado')) {
    return { score: 1, max: 4, excluded: false };
  }
  if (d.includes('no se realizo')) {
    return { score: 0, max: 0, excluded: true };
  }

  return { score: 0, max: 0, excluded: true };
}

export function calcSatisfaccionFromRespuestas(
  respuestas: Array<{ alternativa?: { descripcion?: string | null } | null }>
) {
  let totalScore = 0;
  let totalMax = 0;
  let totalAlternativasRespondidas = 0;
  let totalExcluidas = 0;

  for (const r of respuestas ?? []) {
    const desc = r?.alternativa?.descripcion ?? '';
    if (!desc) continue;

    const { score, max, excluded } = scoreFromAlternativa(desc);

    if (excluded || max === 0) {
      totalExcluidas++;
      continue;
    }

    totalScore += score;
    totalMax += max;
    totalAlternativasRespondidas++;
  }

  const porcentaje = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

  return {
    totalScore,
    totalMaxScore: totalMax,
    totalAlternativasRespondidas,
    totalExcluidas,
    porcentajeSatisfaccion: Math.round(porcentaje * 10) / 10,
  };
}

