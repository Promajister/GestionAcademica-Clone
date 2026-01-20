import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

import {
  CentrosApiService,
  PagedResult,
  CentroEducativoDTO,
} from '../../services/centros-api.service';
import {
  EstudiantesService,
  EstudianteResumen,
} from '../../services/estudiantes.service';
import {
  EncuestasApiService,
  ApiEncuesta,
} from '../../services/encuestas-api.service';
import {
  PracticasService,
  EstadoPractica,
  Practica,
} from '../../services/practicas.service';

type RoleId = 'jefatura' | 'vinculacion' | 'practicas';

interface SelectedRole {
  id: RoleId;
  title: string;
  name: string;
  icon: string;
  permissions: string[];
  color: 'blue' | 'green' | 'purple';
}

interface CardItem {
  title: string;
  icon: string;
  route: string;
  desc?: string;
  subItems?: { title: string; route: string; desc?: string }[];
}

interface ModuleGroup {
  title: string;
  desc?: string;
  items: CardItem[];
}

@Component({
  standalone: true,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
  ],
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private centrosService = inject(CentrosApiService);
  private estudiantesService = inject(EstudiantesService);
  private encuestasService = inject(EncuestasApiService);
  private practicasService = inject(PracticasService);

  themeClass = 'light-theme';

  user = { name: 'Usuario', roleLabel: 'Rol', icon: 'account_circle' };
  cards: CardItem[] = [];
  moduleGroups: ModuleGroup[] = [];

  // Último acceso formateado para mostrar en el hero
  lastLogin: string | null = null;

  summary: {
    estudiantes: number | null;
    centros: number | null;
    encuestas: number | null;
    practicasEnCurso: number | null;
  } = {
    estudiantes: null,
    centros: null,
    encuestas: null,
    practicasEnCurso: null,
  };

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const saved = localStorage.getItem('app.selectedRole');
    const role: SelectedRole | null = saved ? JSON.parse(saved) : null;

    if (role) {
      this.user = {
        name: role.name,
        roleLabel: this.mapRoleLabel(role.id),
        icon: role.icon ?? 'account_circle',
      };
      this.moduleGroups = this.buildGroupsFor(role.id);
      this.cards = this.moduleGroups.flatMap((g) => g.items);
    } else {
      this.moduleGroups = this.buildGroupsFor('vinculacion');
      this.cards = this.moduleGroups.flatMap((g) => g.items);
    }

    // Cargar y formatear último acceso (si existe)
    const rawLastLogin = localStorage.getItem('lastLogin');
    if (rawLastLogin) {
      const d = new Date(rawLastLogin);
      this.lastLogin = d.toLocaleString('es-CL', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } else {
      this.lastLogin = null;
    }

    this.loadSummary();
  }

  private mapRoleLabel(id: RoleId): string {
    switch (id) {
      case 'jefatura':
        return 'Jefatura de Carrera';
      case 'vinculacion':
        return 'Coordinador de Vinculación';
      case 'practicas':
        return 'Coordinador de Prácticas';
    }
  }

  private buildCardsFor(id: RoleId): CardItem[] {
    const comunes: CardItem[] = [];

    if (id === 'jefatura') {
      return [
        {
          title: 'Usuarios',
          icon: 'manage_accounts',
          route: '/usuarios',
          desc: 'Roles y permisos',
        },
        {
          title: 'Prácticas',
          icon: 'assignment',
          route: '/estudiantes-en-practica',
          desc: 'Gestión de estudiantes en práctica',
        },
        {
          title: 'Tutores',
          icon: 'supervisor_account',
          route: '/tutores',
          desc: 'Visualización de tutores',
        },
        {
          title: 'Colaboradores',
          icon: 'groups',
          route: '/colaboradores',
          desc: 'Visualización de colaboradores',
        },
        {
          title: 'Actividades',
          icon: 'event_note',
          route: '/actividades-estudiantes',
          desc: 'Visualización de actividades',
        },
        {
          title: 'Supervisión general',
          icon: 'analytics',
          route: '/reportes',
          desc: 'Reportes y estadísticas',
        },
        {
          title: 'Generar solicitud',
          icon: 'description',
          route: '/carta',
          desc: 'Generar cartas de solicitud de prácticas',
        },
        {
          title: 'Estudiantes',
          icon: 'school',
          route: '/estudiantes',
          desc: 'Visualización de estudiantes',
        },
        {
          title: 'Importar estudiantes',
          icon: 'upload_file',
          route: '/importar-estudiantes',
          desc: 'Importar estudiantes desde excel',
        },
        {
          title: 'Centros educativos',
          icon: 'domain',
          route: '/centros-educativos',
          desc: 'Visualización de centros educativos',
        },
        ...comunes,
      ];
    }

    if (id === 'vinculacion') {
      const miCuenta: CardItem = {
        title: 'Mi cuenta',
        icon: 'person',
        route: '/mi-cuenta',
        desc: 'Perfil y configuración',
      };
      const gestionPracticas: CardItem[] = [
        {
          title: 'Encuestas',
          icon: 'assignment',
          route: '/encuestas',
          desc: 'Registro y análisis de encuestas',
        },
        {
          title: 'Estudiantes',
          icon: 'school',
          route: '/estudiantes',
          desc: 'Seguimiento de estudiantes',
        },
        {
          title: 'Colaboradores',
          icon: 'groups',
          route: '/colaboradores',
          desc: 'Gestión de colaboradores',
        },
        {
          title: 'Centros educativos',
          icon: 'domain',
          route: '/centros-educativos',
          desc: 'Listado de centros educativos',
        },
        {
          title: 'Tutores',
          icon: 'supervisor_account',
          route: '/tutores',
          desc: 'Gestión de tutores',
        },
      ];
      const vinculacionMedio: CardItem[] = [
        {
          title: 'Registrar actividad',
          icon: 'playlist_add',
          route: '/vinculacion/actividades-pm',
          desc: 'Registro de actividades del plan de mejora',
        },
        {
          title: 'Gestionar actividades',
          icon: 'manage_search',
          route: '/vinculacion/actividades-pm/gestion',
          desc: 'Administrar actividades registradas',
        },
        {
          title: 'Encuestas de actividad',
          icon: 'assignment',
          route: '/encuestas-vinculacion',
          desc: 'Registro y seguimiento de encuestas de vinculacion',
        },
      ];
      return [miCuenta, ...gestionPracticas, ...vinculacionMedio, ...comunes];
    }

    if (id === 'practicas') {
      return [
        {
          title: 'Estudiantes',
          icon: 'school',
          route: '/estudiantes',
          desc: 'Seguimiento asignado',
        },
        {
          title: 'Tutores',
          icon: 'supervisor_account',
          route: '/tutores',
          desc: 'Gestión de tutores',
        },
        {
          title: 'Centros educativos',
          icon: 'domain',
          route: '/centros-educativos',
          desc: 'Gestión de centros',
        },
        {
          title: 'Prácticas',
          icon: 'assignment',
          route: '/practicas',
          desc: 'Gestión de prácticas',
        },
        {
          title: 'Colaboradores',
          icon: 'groups',
          route: '/colaboradores',
          desc: 'Gestión de colaboradores',
        },
        {
          title: 'Reportes/Historial',
          icon: 'timeline',
          route: '/reportes',
          desc: 'Historial y reportes',
        },
        {
          title: 'Actividades',
          icon: 'event_note',
          route: '/actividades-estudiantes',
          desc: 'Visualización de actividades',
        },
        ...comunes,
      ];
    }

    return [
      {
        title: 'Encuestas',
        icon: 'assignment',
        route: '/encuestas',
        desc: 'Responde tus formularios',
      },
      ...comunes,
    ];
  }

  private buildGroupsFor(id: RoleId): ModuleGroup[] {
    if (id === 'jefatura') {
      return [
        {
          title: 'General',
          desc: 'Accesos personales',
          items: [
            {
              title: 'Mi cuenta',
              icon: 'person',
              route: '/mi-cuenta',
              desc: 'Perfil y configuración',
            },
          ],
        },
        {
          title: 'Administración',
          desc: 'Control y configuración del sistema',
          items: [
            {
              title: 'Usuarios',
              icon: 'manage_accounts',
              route: '/usuarios',
              desc: 'Roles y permisos',
            },
          ],
        },
        {
          title: 'Gestión de prácticas',
          desc: 'Funcionalidades asociadas a la gestión de prácticas profesionales',
          items: [
            {
              title: 'Prácticas',
              icon: 'assignment',
              route: '/estudiantes-en-practica',
              desc: 'Gestión de estudiantes en práctica',
            },
            {
              title: 'Estudiantes',
              icon: 'school',
              route: '/estudiantes',
              desc: 'Visualización de estudiantes',
            },
            {
              title: 'Importar estudiantes',
              icon: 'upload_file',
              route: '/importar-estudiantes',
              desc: 'Importar estudiantes desde excel',
            },
            {
              title: 'Tutores',
              icon: 'supervisor_account',
              route: '/tutores',
              desc: 'Visualización de tutores',
            },
            {
              title: 'Colaboradores',
              icon: 'groups',
              route: '/colaboradores',
              desc: 'Visualización de colaboradores',
            },
            {
              title: 'Centros educativos',
              icon: 'domain',
              route: '/centros-educativos',
              desc: 'Visualización de centros educativos',
            },
            {
              title: 'Actividades',
              icon: 'event_note',
              route: '/actividades-estudiantes',
              desc: 'Visualización de actividades',
            },
            {
              title: 'Supervisión general',
              icon: 'analytics',
              route: '/reportes',
              desc: 'Reportes y estadísticas',
            },
            {
              title: 'Generar solicitud',
              icon: 'description',
              route: '/carta',
              desc: 'Generar cartas de solicitud de prácticas',
            },
          ],
        },
        {
          title: 'Vinculación con el medio',
          desc: 'Funcionalidades asociadas a la gestión de actividades pertenecientes al plan de mejora',
          items: [
            {
              title: 'Registrar actividad',
              icon: 'playlist_add',
              route: '/vinculacion/actividades-pm',
              desc: 'Registro de actividades del plan de mejora',
            },
            {
              title: 'Gestionar actividades',
              icon: 'manage_search',
              route: '/vinculacion/actividades-pm/gestion',
              desc: 'Administrar actividades registradas',
            },
          ],
        },
        {
          title: 'Egresados y Empleabilidad',
          desc: 'Funcionalidades para el seguimiento de egresados y empleabilidad',
          items: [
            {
              title: 'Registrar datos de empleabilidad',
              icon: 'how_to_reg',
              route: '/egresados/empleabilidad',
              desc: 'Carga de datos de empleabilidad',
            },
          ],
        },
      ];
    }

    if (id === 'vinculacion') {
      return [
        {
          title: 'General',
          desc: 'Accesos personales',
          items: [
            {
              title: 'Mi cuenta',
              icon: 'person',
              route: '/mi-cuenta',
              desc: 'Perfil y configuración',
            },
          ],
        },
        {
          title: 'Gestión de prácticas',
          desc: 'Funcionalidades asociadas a la gestión de prácticas profesionales',
          items: [
            {
              title: 'Encuestas',
              icon: 'assignment',
              route: '/encuestas',
              desc: 'Registro y análisis de encuestas',
            },
            {
              title: 'Estudiantes',
              icon: 'school',
              route: '/estudiantes',
              desc: 'Seguimiento de estudiantes',
            },
            {
              title: 'Colaboradores',
              icon: 'groups',
              route: '/colaboradores',
              desc: 'Gestión de colaboradores',
            },
            {
              title: 'Centros educativos',
              icon: 'domain',
              route: '/centros-educativos',
              desc: 'Listado de centros educativos',
            },
            {
              title: 'Tutores',
              icon: 'supervisor_account',
              route: '/tutores',
              desc: 'Gestión de tutores',
            },
          ],
        },
        {
          title: 'Vinculación con el medio',
          desc: 'Funcionalidades asociadas a la gestión de actividades pertenecientes al plan de mejora',
          items: [
            {
              title: 'Registrar actividad',
              icon: 'playlist_add',
              route: '/vinculacion/actividades-pm',
              desc: 'Registro de actividades del plan de mejora',
            },
            {
              title: 'Gestionar actividades',
              icon: 'manage_search',
              route: '/vinculacion/actividades-pm/gestion',
              desc: 'Administrar actividades registradas',
            },
            {
              title: 'Encuestas de actividad',
              icon: 'assignment',
              route: '/encuestas-vinculacion',
              desc: 'Registro y seguimiento de encuestas de vinculacion',
            },
          ],
        },
      ];
    }

    if (id === 'practicas') {
      return [
        {
          title: 'General',
          desc: 'Accesos personales',
          items: [
            {
              title: 'Mi cuenta',
              icon: 'person',
              route: '/mi-cuenta',
              desc: 'Perfil y configuración',
            },
          ],
        },
        {
          title: 'Gestión de prácticas',
          desc: 'Funcionalidades asociadas a la gestión de prácticas profesionales',
          items: [
            {
              title: 'Estudiantes',
              icon: 'school',
              route: '/estudiantes',
              desc: 'Seguimiento asignado',
            },
            {
              title: 'Tutores',
              icon: 'supervisor_account',
              route: '/tutores',
              desc: 'Gestión de tutores',
            },
            {
              title: 'Colaboradores',
              icon: 'groups',
              route: '/colaboradores',
              desc: 'Gestión de colaboradores',
            },
            {
              title: 'Centros educativos',
              icon: 'domain',
              route: '/centros-educativos',
              desc: 'Gestión de centros',
            },
            {
              title: 'Prácticas',
              icon: 'assignment',
              route: '/practicas',
              desc: 'Gestión de prácticas',
            },
            {
              title: 'Actividades',
              icon: 'event_note',
              route: '/actividades-estudiantes',
              desc: 'Visualización de actividades',
            },
            {
              title: 'Reportes/Historial',
              icon: 'timeline',
              route: '/reportes',
              desc: 'Historial y reportes',
            },
          ],
        },
      ];
    }

    return [
      {
        title: 'Módulos del sistema',
        desc: 'Selecciona un módulo para acceder a sus funciones.',
        items: this.buildCardsFor(id),
      },
    ];
  }

  /** Carga los totales para las tarjetas de resumen */
  private loadSummary(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // CENTROS
    this.centrosService.list({ page: 1, limit: 1 }).subscribe({
      next: (res: PagedResult<CentroEducativoDTO>) => {
        this.summary.centros =
          (res && typeof res.total === 'number'
            ? res.total
            : res?.items?.length ?? 0) || 0;
      },
      error: () => {
        this.summary.centros = null;
      },
    });

    // ESTUDIANTES
    this.estudiantesService.listar().subscribe({
      next: (estudiantes: EstudianteResumen[]) => {
        this.summary.estudiantes = estudiantes?.length ?? 0;
      },
      error: () => {
        this.summary.estudiantes = null;
      },
    });

    // ENCUESTAS
    this.encuestasService.getEncuestasRegistradas().subscribe({
      next: (encuestas: ApiEncuesta[]) => {
        this.summary.encuestas = encuestas?.length ?? 0;
      },
      error: () => {
        this.summary.encuestas = null;
      },
    });

    // PRÁCTICAS EN CURSO
    this.practicasService
      .listar({ estado: 'EN_CURSO' as EstadoPractica })
      .subscribe({
        next: (practicas: Practica[]) => {
          this.summary.practicasEnCurso = practicas?.length ?? 0;
        },
        error: () => {
          this.summary.practicasEnCurso = null;
        },
      });
  }

  go(path: string): void {
    this.router.navigate([path]);
  }
}
