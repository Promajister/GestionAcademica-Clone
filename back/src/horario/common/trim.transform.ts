// Para @Transform: recorta strings antes de validar (un valor de solo espacios queda vacío)
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
