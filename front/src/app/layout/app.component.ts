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
import { NotificationsService } from '../services/notifications.service';
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

interface NavSection {
  id: 'practicas' | 'vinculacion' | 'egresados';
  title: string;
  icon: string;
  items: NavItem[];
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
  private notifications = inject(NotificationsService);

  @ViewChild(MatSidenav) sidenav?: MatSidenav;

  private navigationSub?: Subscription;

  private closeSidenavListener = () => {
    this.isSidenavOpened = false;
    this.sidenav?.close();
  };

  isAuthRoute = false;
  isSidenavOpened = true;

  user!: { name: string; roleLabel: string; icon: string };
  rolePermissions: string[] = [];

  nav: NavItem[] = [];

  isJefatura = false;
  isVinculacion = false;
  navSections: NavSection[] = [];
  openSections: Record<'practicas' | 'vinculacion' | 'egresados', boolean> = {
    practicas: true,
    vinculacion: true,
    egresados: true,
  };

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    window.addEventListener('app:close-sidenav', this.closeSidenavListener);

    this.isAuthRoute = this.isAuthUrl(this.router.url);

    this.loadRoleFromStorage();  
    this.notifications.start();

    this.navigationSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const url = event.urlAfterRedirects || event.url;
        this.isAuthRoute = this.isAuthUrl(url);

        this.loadRoleFromStorage();
      });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    queueMicrotask(() => {
      this.loadRoleFromStorage();
    });
  }

  private isAuthUrl(url: string): boolean {
    const clean = url.split('?')[0].split('#')[0];
    return (
      clean === '/login' ||
      clean === '/recuperar-clave' ||
      clean.startsWith('/login/') ||
      clean.startsWith('/recuperar-clave/')
    );
  }

  private loadRoleFromStorage() {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const saved = localStorage.getItem('app.selectedRole');
      if (saved) {
        const role = JSON.parse(saved) as SavedRole;
        if (role?.id) {
          this.applyRole(role);
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

    const role: SavedRole = {
      id,
      title: this.mapRoleLabel(id),
      name: authUser.nombre || authUser.email,
      icon: this.mapRoleIcon(id),
      permissions: [],
      color: this.mapRoleColor(id),
    };

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('app.selectedRole', JSON.stringify(role));
    }

    this.applyRole(role);
  }

  private applyRole(role: SavedRole) {
    this.user = {
      name: role.name,
      roleLabel: role.title,
      icon: role.icon ?? 'account_circle',
    };

    this.rolePermissions = Array.isArray(role.permissions) ? role.permissions : [];

    this.isJefatura = role.id === 'jefatura';
    this.isVinculacion = role.id === 'vinculacion';

    this.navSections = [];

    if (this.isJefatura) {
      this.nav = [
        { label: 'Mi cuenta', icon: 'person', route: '/mi-cuenta' },
        { label: 'Usuarios', icon: 'manage_accounts', route: '/usuarios' },
      ];
      this.navSections = this.buildJefaturaSections();
    } else {
      this.nav = this.buildNav(role.id);

      if (this.isVinculacion) {
        this.navSections = this.buildVinculacionSections();
      }
    }
  }

  onSidenavChange(opened: boolean) {
    this.isSidenavOpened = opened;
  }

  toggleSidenav(sidenav: MatSidenav) {
    sidenav.toggle();
  }

  goHome() {
    this.router.navigate(['/dashboard']);
  }

  toggleSection(id: 'practicas' | 'vinculacion' | 'egresados') {
    this.openSections[id] = !this.openSections[id];
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('app.selectedRole');
    }
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('app:close-sidenav', this.closeSidenavListener);
    }
    this.navigationSub?.unsubscribe();
    this.notifications.stop();
  }

  private mapRoleLabel(id: RoleId): string {
    return id === 'jefatura'
      ? 'Jefatura de Carrera'
      : id === 'vinculacion'
      ? 'Coordinador de Vinculación'
      : 'Coordinador de Prácticas';
  }

  private mapRoleIcon(id: RoleId): string {
    return id === 'jefatura'
      ? 'school'
      : id === 'vinculacion'
      ? 'groups'
      : 'assignment_ind';
  }

  private mapRoleColor(id: RoleId) {
    return id === 'jefatura'
      ? 'purple'
      : id === 'vinculacion'
      ? 'green'
      : 'blue';
  }

  private buildJefaturaSections(): NavSection[] {
    return [
      {
        id: 'practicas',
        title: 'Gestión de prácticas',
        icon: 'assignment_ind',
        items: [
          { label: 'Estudiantes', icon: 'school', route: '/estudiantes' },
          { label: 'Importar estudiantes', icon: 'upload_file', route: '/importar-estudiantes' },
          { label: 'Prácticas', icon: 'assignment', route: '/estudiantes-en-practica' },
          { label: 'Tutores', icon: 'supervisor_account', route: '/tutores' },
          { label: 'Colaboradores', icon: 'groups', route: '/colaboradores' },
          { label: 'Centros Educativos', icon: 'domain', route: '/centros-educativos' },
          { label: 'Actividades', icon: 'event_note', route: '/actividades-estudiantes' },
          { label: 'Supervisión General', icon: 'analytics', route: '/reportes' },
          { label: 'Generar Solicitud', icon: 'description', route: '/carta' },
        ],
      },
      {
        id: 'vinculacion',
        title: 'Vinculación con el medio',
        icon: 'groups',
        items: [
          {
            label: 'Registrar actividad',
            icon: 'playlist_add',
            route: '/vinculacion/actividades-pm',
          },
          {
            label: 'Gestionar actividad',
            icon: 'manage_search',
            route: '/vinculacion/actividades-pm/gestion',
          },
        ],
      },
      {
        id: 'egresados',
        title: 'Egresados y Empleabilidad',
        icon: 'work',
        items: [
          {
            label: 'Registro de egresados',
            icon: 'how_to_reg',
            route: '/egresados/registro',
          },
          {
            label: 'Encuestas',
            icon: 'assignment',
            route: '/egresados/encuestas',
          },
        ],
      },
    ];
  }

  private buildVinculacionSections(): NavSection[] {
    return [
      {
        id: 'practicas',
        title: 'Gestión de prácticas',
        icon: 'assignment_ind',
        items: [
          { label: 'Encuestas', icon: 'assignment', route: '/encuestas' },
          { label: 'Estudiantes', icon: 'school', route: '/estudiantes' },
          { label: 'Colaboradores', icon: 'groups', route: '/colaboradores' },
          { label: 'Centros Educativos', icon: 'domain', route: '/centros-educativos' },
          { label: 'Tutores', icon: 'supervisor_account', route: '/tutores' },
        ],
      },
      {
        id: 'vinculacion',
        title: 'Vinculación con el medio',
        icon: 'groups',
        items: [
          { label: 'Registrar actividad', icon: 'playlist_add', route: '/vinculacion/actividades-pm' },
          { label: 'Gestionar actividad', icon: 'manage_search', route: '/vinculacion/actividades-pm/gestion' },
          { label: 'Encuestas de actividad', icon: 'assignment', route: '/encuestas-vinculacion' },
        ],
      },
    ];
  }

  private buildNav(id: RoleId): NavItem[] {
    if (id === 'vinculacion') {
      return [
        { label: 'Mi cuenta', icon: 'person', route: '/mi-cuenta' },
      ];
    }


    return [
      { label: 'Mi cuenta', icon: 'person', route: '/mi-cuenta' },
      { label: 'Estudiantes', icon: 'school', route: '/estudiantes' },
      { label: 'Tutores', icon: 'supervisor_account', route: '/tutores' },
      { label: 'Colaboradores', icon: 'groups', route: '/colaboradores' },
      { label: 'Centros Educativos', icon: 'domain', route: '/centros-educativos' },
      { label: 'Prácticas', icon: 'assignment', route: '/practicas' },
      { label: 'Actividades', icon: 'event_note', route: '/actividades-estudiantes' },
      { label: 'Supervisión General', icon: 'analytics', route: '/reportes' },
    ];
  }

  get initials(): string {
    const parts = this.user?.name?.trim().split(/\s+/) ?? [];
    const a = parts[0]?.[0] ?? '';
    const b = parts[1]?.[0] ?? '';
    return (a + b).toUpperCase();
  }
}
