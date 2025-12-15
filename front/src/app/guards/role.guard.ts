import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowed = route.data?.['allowedRoles'] as string[] | undefined;
  const user = auth.getCurrentUser?.();
  const userRole = user?.role;

  // Si no se especifican roles permitidos, dejar pasar
  if (!allowed || allowed.length === 0) {
    return true;
  }

  if (userRole && allowed.includes(userRole)) {
    return true;
  }

  // Si no tiene permiso, redirigir al dashboard
  router.navigate(['/dashboard']);
  return false;
};
