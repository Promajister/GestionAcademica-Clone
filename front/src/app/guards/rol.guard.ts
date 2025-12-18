import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service'; // ajusta si tu auth service está en otra ruta

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  private auth = inject(AuthService);
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const allowed = (route.data['roles'] as string[]) ?? [];
    const user = this.auth.getCurrentUser();
    const role = user?.role;

    if (!role) return this.router.createUrlTree(['/login']);
    return allowed.includes(role) ? true : this.router.createUrlTree(['/dashboard']);
  }
}
