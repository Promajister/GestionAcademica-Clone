import { Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule }   from '@angular/material/icon';
import { MatCardModule }   from '@angular/material/card';

type RoleId = 'jefatura' | 'vinculacion' | 'practicas';

interface Role {
  id: RoleId;
  title: string;
  name: string;
  description: string;
  permissions: string[];
  icon: string;
  color: 'blue' | 'green' | 'purple';
}

@Component({
  standalone: true,
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [CommonModule, MatButtonModule, MatIconModule, MatCardModule]
})
export class HomeComponent {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  roles: Role[] = [
    {
      id: 'practicas',
      title: 'Coordinadora de Prácticas',
      name: 'Carolina Quintana',
      description: 'Registra estudiantes, centros educativos y gestiona el proceso de prácticas.',
      permissions: [
        'Gestionar centros educativos',
        'Gestionar estudiantes',
        'Asignar prácticas',
        'Gestionar tutores',
        'Gestionar colaboradores',
        'Ver reportes e historial'
      ],
      icon: 'school',
      color: 'blue'
    },
    {
      id: 'vinculacion',
      title: 'Coordinadora de Vinculación',
      name: 'Claudia Palomo',
      description: 'Registra y administra los resultados de las encuestas.',
      permissions: [
        'Registrar encuestas'
      ],
      icon: 'groups',
      color: 'green'
    },
    {
      id: 'jefatura',
      title: 'Jefatura de Carrera',
      name: 'Johana Rojas',
      description: 'Visualiza reportes globales y gestiona cartas de presentación.',
      permissions: [
        'Reportes completos',
        'Generar cartas',
        'Supervisión general'
      ],
      icon: 'description',
      color: 'purple'
    }
  ];

  /** Guarda el rol elegido y navega al dashboard */
  selectRole(roleId: RoleId) {
    const role = this.roles.find(r => r.id === roleId);
    if (role && isPlatformBrowser(this.platformId)) {
      localStorage.setItem('app.selectedRole', JSON.stringify(role));
    }
    this.router.navigate(['/dashboard']);
  }

  getRoleColorClass(role: Role) {
    return `role-${role.color}`;
  }
}
