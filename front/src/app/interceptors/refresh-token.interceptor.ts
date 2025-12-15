import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, finalize, switchMap, throwError } from 'rxjs';

let refreshRequest$: ReturnType<AuthService['refreshSession']> | null = null;

export const refreshTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const isAuthRoute = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
  if (isAuthRoute) return next(req);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if ((error.status === 401 || error.status === 419) && auth.isLoggedIn()) {
        if (!refreshRequest$) {
          refreshRequest$ = auth.refreshSession().pipe(finalize(() => (refreshRequest$ = null)));
        }

        return refreshRequest$!.pipe(
          switchMap(() => next(req)),
          catchError((err) => {
            auth.logout();
            return throwError(() => err);
          }),
        );
      }

      return throwError(() => error);
    }),
  );
};
