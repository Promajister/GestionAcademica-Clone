export function parseDateFlexible(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const matchLatam = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchLatam) {
    const day = Number(matchLatam[1]);
    const month = Number(matchLatam[2]);
    const year = Number(matchLatam[3]);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const matchIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    const year = Number(matchIso[1]);
    const month = Number(matchIso[2]);
    const day = Number(matchIso[3]);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateEs(value?: string | Date | null): string {
  const d = parseDateFlexible(value);
  if (!d) return value ? String(value) : '';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}
