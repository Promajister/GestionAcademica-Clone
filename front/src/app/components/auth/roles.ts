export const ROLES = {
  JEFATURA: 'jefatura',
  PRACTICAS: 'practicas',
  VINCULACION: 'vinculacion',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];
