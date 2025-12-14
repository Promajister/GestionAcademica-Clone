import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Guard sencillo: permite solo si el rol es "jefatura".
 * Obtiene el rol desde:
 *  - header x-role o x-user-role
 *  - req.user?.role (si en el futuro hay auth real)
 */
@Injectable()
export class JefaturaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const headerRole =
      req.headers['x-role'] ||
      req.headers['x-user-role'] ||
      req.headers['x_user_role'];

    const role = (headerRole || req.user?.role || req.user?.rol?.clave || '').toString().toLowerCase();

    if (role === 'jefatura') {
      return true;
    }

    throw new ForbiddenException('Solo Jefatura de Carrera puede realizar esta acción');
  }
}
