import { HttpInterceptorFn } from '@angular/common/http';

// Fuerza a enviar credenciales (cookies) en todas las peticiones HTTP.
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const authReq = req.clone({ withCredentials: true });
  return next(authReq);
};
