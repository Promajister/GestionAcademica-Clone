import {
  Component,
  inject,
  OnInit,
  AfterViewInit,
  PLATFORM_ID,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';

/** IDs de rol válidos en toda la app */
type RoleId = 'jefatura' | 'vinculacion' | 'practicas';

/** Estructura que guardas en localStorage */
interface SavedRole {
  id: RoleId;
  title: string;
  name: string;
  icon?: string;
  permissions: string[];
  color?: 'blue' | 'green' | 'purple';
}

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);

  @ViewChild(MatSidenav) sidenav?: MatSidenav;

  private navigationSub?: Subscription;

  private closeSidenavListener = () => {
    this.isSidenavOpened = false;
    this.sidenav?.close();
  };

  /**
   * true cuando la ruta actual es de autenticación:
   * - /login
   * - /recuperar-clave
   */
  isAuthRoute = false;

  isSidenavOpened = true;
  appTitle = 'Sistema de Prácticas';

  user = { name: 'Invitado', roleLabel: 'Sin rol', icon: 'account_circle' };
  rolePermissions: string[] = [];
  nav: NavItem[] = [];

  ngOnInit(): void {
    // Fallback por defecto (SSR / antes de que cargue usuario real)
    this.applyRole('practicas');

    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('app:close-sidenav', this.closeSidenavListener);

      // Evaluar URL actual al iniciar
      this.isAuthRoute = this.isAuthUrl(this.router.url);
      this.loadRoleFromStorage();

      // Escuchar cambios de navegación
      this.navigationSub = this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe((event: NavigationEnd) => {
          const url = event.urlAfterRedirects || event.url;
          this.isAuthRoute = this.isAuthUrl(url);
          this.loadRoleFromStorage();
        });
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      queueMicrotask(() => this.loadRoleFromStorage());
    }
  }

  /** Devuelve true si la URL corresponde a login o recuperar clave */
  private isAuthUrl(url: string): boolean {
    const cleanUrl = url.split('?')[0].split('#')[0];

    return (
      cleanUrl === '/login' ||
      cleanUrl === '/recuperar-clave' ||
      cleanUrl.startsWith('/login/') ||
      cleanUrl.startsWith('/recuperar-clave/')
    );
  }

  // ------- Lógica de rol -------
  private loadRoleFromStorage() {
    try {
      const saved = isPlatformBrowser(this.platformId)
        ? localStorage.getItem('app.selectedRole')
        : null;

      if (saved) {
        const r = JSON.parse(saved) as SavedRole;
        if (r?.id) {
          this.applyRole(r.id, r);
          return;
        }
      }

      // Si no hay rol guardado, intentamos usar el usuario autenticado
      this.syncRoleFromAuthUser();
    } catch {
      this.syncRoleFromAuthUser();
    }
  }

  private syncRoleFromAuthUser() {
    // usamos el usuario guardado por AuthService (app.user)
    const authUser = this.auth.getCurrentUser?.();
    if (!authUser?.role) return;

    const id = authUser.role as RoleId;

    const savedRole: SavedRole = {
      id,
      title: this.mapRoleLabel(id),
      name: authUser.nombre || authUser.email,
      icon:
        id === 'jefatura'
          ? 'school'
          : id === 'vinculacion'
          ? 'groups'
          : 'assignment_ind',
      permissions: [], // si después quieres, aquí metes permisos por rol
      color:
        id === 'jefatura'
          ? 'purple'
          : id === 'vinculacion'
          ? 'green'
          : 'blue',
    };

    // aplicamos el rol al layout
    this.applyRole(id, savedRole);

    // y además lo guardamos para futuras recargas
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('app.selectedRole', JSON.stringify(savedRole));
    }
  }

  private applyRole(id: RoleId, r?: SavedRole) {
    this.user.name = r?.name ?? this.user.name;
    this.user.roleLabel = r?.title ?? this.mapRoleLabel(id);
    this.user.icon = r?.icon ?? this.user.icon;
    this.rolePermissions = Array.isArray(r?.permissions) ? r!.permissions : [];
    this.nav = this.buildNav(id);
  }

  // ------- UI -------
  onSidenavChange(opened: boolean) {
    this.isSidenavOpened = opened;
  }

  toggleSidenav(sidenav: MatSidenav) {
    sidenav.toggle();
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('app.selectedRole');
    }

    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  goHome() {
    this.router.navigate(['/dashboard']);
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('app:close-sidenav', this.closeSidenavListener);
    }
    this.navigationSub?.unsubscribe();
  }

  // ------- Helpers -------
  private mapRoleLabel(id: RoleId): string {
    switch (id) {
      case 'jefatura':
        return 'Jefatura de Carrera';
      case 'vinculacion':
        return 'Coordinador de Vinculación';
      case 'practicas':
        return 'Coordinador de Prácticas';
      default:
        return 'Sin rol';
    }
  }

  private buildNav(id: RoleId): NavItem[] {
    if (id === 'jefatura') {
      return [
        { label: 'Usuarios', icon: 'manage_accounts', route: '/usuarios' },
        { label: 'Estudiantes en Práctica', icon: 'school', route: '/estudiantes-en-practica' },
        { label: 'Tutores', icon: 'supervisor_account', route: '/tutores' },
        { label: 'Colaboradores', icon: 'groups', route: '/colaboradores' },
        { label: 'Actividades', icon: 'event_note', route: '/actividades-estudiantes' },
        { label: 'Supervisión General', icon: 'analytics', route: '/reportes' },
        { label: 'Generar Solicitud', icon: 'description', route: '/carta' },
      ];
    }

    if (id === 'vinculacion') {
      return [
        { label: 'Encuestas', icon: 'assignment', route: '/encuestas' },
        { label: 'Estudiantes', icon: 'school', route: '/estudiantes' },
        { label: 'Colaboradores', icon: 'groups', route: '/colaboradores' },
        { label: 'Centros Educativos', icon: 'domain', route: '/centros-educativos' },
        { label: 'Tutores', icon: 'supervisor_account', route: '/tutores' },
      ];
    }

    if (id === 'practicas') {
      return [
        { label: 'Estudiantes', icon: 'school', route: '/estudiantes' },
        { label: 'Tutores', icon: 'supervisor_account', route: '/tutores' },
        { label: 'Colaboradores', icon: 'groups', route: '/colaboradores' },
        { label: 'Centros Educativos', icon: 'domain', route: '/centros-educativos' },
        { label: 'Prácticas', icon: 'event_note', route: '/practicas' },
        { label: 'Actividades', icon: 'assignment', route: '/actividades-estudiantes' },
        { label: 'Reportes/Historial', icon: 'timeline', route: '/reportes' },
      ];
    }

    return [];
  }
}