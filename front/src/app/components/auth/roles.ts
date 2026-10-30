export const ROLES = {
  JEFATURA: 'jefatura',
  PRACTICAS: 'practicas',
  VINCULACION: 'vinculacion',
  PROFESOR: 'profesor',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];
