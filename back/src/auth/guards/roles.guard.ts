import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

const normalizeRole = (role?: string): string | null => {
  if (!role) return null;
  return role
    .toString()
    .normalize('NFD')
    // elimina tildes/acentos
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no hay roles declarados, permitir acceso.
    if (!allowedRoles || allowedRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const userRole: string | undefined = request.user?.role;

    const normalizedUserRole = normalizeRole(userRole);
    const normalizedAllowed = allowedRoles.map(normalizeRole).filter(Boolean) as string[];

    return (
      !!normalizedUserRole &&
      normalizedAllowed.some(
        (role) =>
          role === normalizedUserRole ||
          normalizedUserRole.includes(role) ||
          role.includes(normalizedUserRole),
      )
    );
  }
}
