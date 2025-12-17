import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (environment.skipAuth) {
    if (!auth.isLoggedIn()) {
      router.navigate(['login'], { queryParams: { returnUrl: state.url } });
      return false;
    }
    return true;
  }

  if (!auth.isLoggedIn()) {
    router.navigate(['login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  if (auth.hasValidAccessToken()) {
    return true;
  }

  // Intentar refrescar si el access token caducó o falta
  return auth.refreshSession().pipe(
    map(() => true),
    catchError(() => {
      auth.logout();
      router.navigate(['login'], { queryParams: { returnUrl: state.url } });
      return of(false);
    }),
  );
};
