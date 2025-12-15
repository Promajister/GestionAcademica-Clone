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

type RoleId = 'jefatura' | 'vinculacion' | 'practicas';

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
  private photoKey = 'app.profilePhoto';

  @ViewChild(MatSidenav) sidenav?: MatSidenav;

  private navigationSub?: Subscription;

  private closeSidenavListener = () => {
    this.isSidenavOpened = false;
    this.sidenav?.close();
  };

  isAuthRoute = false;

  isSidenavOpened = true;
  appTitle = 'Sistema de Prácticas';

  user = { name: 'Invitado', roleLabel: 'Sin rol', icon: 'account_circle' };
  rolePermissions: string[] = [];
  nav: NavItem[] = [];
  profilePhoto: string | null = null;

  ngOnInit(): void {
    this.applyRole('practicas');

    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('app:close-sidenav', this.closeSidenavListener);

      this.isAuthRoute = this.isAuthUrl(this.router.url);
      this.loadRoleFromStorage();
      this.loadProfilePhoto();

      this.navigationSub = this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe((event: NavigationEnd) => {
          const url = event.urlAfterRedirects || event.url;
          this.isAuthRoute = this.isAuthUrl(url);
          this.loadRoleFromStorage();
          this.loadProfilePhoto();
        });
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      queueMicrotask(() => {
        this.loadRoleFromStorage();
        this.loadProfilePhoto();
      });
    }
  }

  private isAuthUrl(url: string): boolean {
    const cleanUrl = url.split('?')[0].split('#')[0];

    return (
      cleanUrl === '/login' ||
      cleanUrl === '/recuperar-clave' ||
      cleanUrl.startsWith('/login/') ||
      cleanUrl.startsWith('/recuperar-clave/')
    );
  }

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

      this.syncRoleFromAuthUser();
    } catch {
      this.syncRoleFromAuthUser();
    }
  }

  private syncRoleFromAuthUser() {
    const authUser = this.auth.getCurrentUser?.();
    if (!authUser?.role) return;

    const id = authUser.role as RoleId;

    const savedRole: SavedRole = {
      id,
      title: this.mapRoleLabel(id),
      name: authUser.nombre || authUser.email,
      icon: id === 'jefatura' ? 'school' : id === 'vinculacion' ? 'groups' : 'assignment_ind',
      permissions: [],
      color: id === 'jefatura' ? 'purple' : id === 'vinculacion' ? 'green' : 'blue',
    };

    this.applyRole(id, savedRole);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('app.selectedRole', JSON.stringify(savedRole));
    }
  }

  private loadProfilePhoto() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.profilePhoto = localStorage.getItem(this.photoKey);
  }

  private applyRole(id: RoleId, r?: SavedRole) {
    this.user.name = r?.name ?? this.user.name;
    this.user.roleLabel = r?.title ?? this.mapRoleLabel(id);
    this.user.icon = r?.icon ?? this.user.icon;
    this.rolePermissions = Array.isArray(r?.permissions) ? r!.permissions : [];
    this.nav = this.buildNav(id);
  }

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

  goProfile() {
    this.router.navigate(['/mi-cuenta']);
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('app:close-sidenav', this.closeSidenavListener);
    }
    this.navigationSub?.unsubscribe();
  }

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
    const base: NavItem[] = [{ label: 'Mi cuenta', icon: 'person', route: '/mi-cuenta' }];

    if (id === 'jefatura') {
      return [
        ...base,
        { label: 'Usuarios', icon: 'manage_accounts', route: '/usuarios' },
        { label: 'Estudiantes', icon: 'school', route: '/estudiantes' },
        { label: 'Estudiantes en práctica', icon: 'school', route: '/estudiantes-en-practica' },
        { label: 'Tutores', icon: 'supervisor_account', route: '/tutores' },
        { label: 'Colaboradores', icon: 'groups', route: '/colaboradores' },
        { label: 'Actividades', icon: 'assignment', route: '/actividades-estudiantes' },
        { label: 'Supervisión general', icon: 'insights', route: '/supervision' },
        { label: 'Reportes completos', icon: 'analytics', route: '/reportes' },
        { label: 'Generar solicitud', icon: 'description', route: '/carta' },
      ];
    }

    if (id === 'vinculacion') {
      return [
        ...base,
        { label: 'Encuestas', icon: 'assignment', route: '/encuestas' },
        { label: 'Estudiantes', icon: 'school', route: '/estudiantes' },
        { label: 'Colaboradores', icon: 'groups', route: '/colaboradores' },
        { label: 'Centros educativos', icon: 'domain', route: '/centros-educativos' },
        { label: 'Tutores', icon: 'supervisor_account', route: '/tutores' },
      ];
    }

    if (id === 'practicas') {
      return [
        ...base,
        { label: 'Estudiantes', icon: 'school', route: '/estudiantes' },
        { label: 'Tutores', icon: 'supervisor_account', route: '/tutores' },
        { label: 'Colaboradores', icon: 'groups', route: '/colaboradores' },
        { label: 'Centros educativos', icon: 'domain', route: '/centros-educativos' },
        { label: 'Prácticas', icon: 'event_note', route: '/practicas' },
        { label: 'Actividades', icon: 'assignment', route: '/actividades-estudiantes' },
        { label: 'Reportes/Historial', icon: 'timeline', route: '/reportes' },
      ];
    }

    return base;
  }

  get initials(): string {
    const n = this.user?.name || '';
    const parts = n.trim().split(/\s+/);
    const [a = '', b = ''] = parts;
    const letters = (a[0] || '') + (b[0] || '');
    return letters.toUpperCase() || 'U';
  }
}
