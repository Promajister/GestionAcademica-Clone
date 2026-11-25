import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, finalize, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

let refreshRequest$: ReturnType<AuthService['refreshSession']> | null = null;

// Al renovar la sesión el backend entrega un token CSRF nuevo: la petición que se reintenta
// debe llevar ese token, no el que tenía cuando falló
function conCsrfActual(req: HttpRequest<unknown>): HttpRequest<unknown> {
  const nombre = ['X-CSRF-Token', 'x-csrf-token'].find((h) => req.headers.has(h));
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('app.token') : null;
  return nombre && token ? req.clone({ setHeaders: { [nombre]: token } }) : req;
}

export const refreshTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (environment.skipAuth) {
    return next(req);
  }

  const isAuthRoute = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
  if (isAuthRoute) return next(req);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if ((error.status === 401 || error.status === 419) && auth.isLoggedIn()) {
        if (!refreshRequest$) {
          refreshRequest$ = auth.refreshSession().pipe(finalize(() => (refreshRequest$ = null)));
        }

        return refreshRequest$!.pipe(
          // Solo un fallo de la renovación cierra la sesión; un error de la petición reintentada
          // (ej. 409 al mover una clase) llega tal cual a la pantalla
          catchError((err) => {
            // La sesión no se pudo renovar: se cierra y se vuelve al login, en vez de dejar
            // la página abierta sin sesión (donde todo lo que se guarda falla)
            auth.logout();
            if (!router.url.startsWith('/login')) {
              router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
            }
            return throwError(() => err);
          }),
          switchMap(() => next(conCsrfActual(req))),
        );
      }

      return throwError(() => error);
    }),
  );
};
