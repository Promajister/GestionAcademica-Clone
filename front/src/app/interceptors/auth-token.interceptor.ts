import { HttpInterceptorFn } from '@angular/common/http';

// Adjunta Authorization: Bearer <accessToken> si está almacenado.
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('app.accessToken') : null;
  if (!token) return next(req);

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(authReq);
};
