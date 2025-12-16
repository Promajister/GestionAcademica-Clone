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
      this.cards = this.buildCardsFor(role.id);
    } else {
      this.cards = this.buildCardsFor('vinculacion');
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
          title: 'Estudiantes en práctica',
          icon: 'school',
          route: '/estudiantes-en-practica',
          desc: 'Visualización de estudiantes en práctica',
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
          icon: 'assignment',
          route: '/actividades-estudiantes',
          desc: 'Visualización de actividades',
        },
        {
          title: 'Reportes completos',
          icon: 'analytics',
          route: '/reportes',
          desc: 'Reportes y estadísticas',
        },
        {
          title: 'Generar solicitud',
          icon: 'description',
          route: '/carta',
          desc: 'Generar cartas de presentación',
        },
        ...comunes,
      ];
    }

    if (id === 'vinculacion') {
      return [
        {
          title: 'Centros educativos',
          icon: 'domain',
          route: '/centros-educativos',
          desc: 'Listado de centros educativos',
        },
        {
          title: 'Colaboradores',
          icon: 'groups',
          route: '/colaboradores',
          desc: 'Gestión de colaboradores',
        },
        {
          title: 'Estudiantes',
          icon: 'school',
          route: '/estudiantes',
          desc: 'Seguimiento de estudiantes',
        },
        {
          title: 'Encuestas',
          icon: 'assignment',
          route: '/encuestas',
          desc: 'Registro y análisis de encuestas',
        },
        {
          title: 'Tutores',
          icon: 'supervisor_account',
          route: '/tutores',
          desc: 'Gestión de tutores',
        },
        ...comunes,
      ];
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
          icon: 'event_note',
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
          icon: 'assignment',
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
