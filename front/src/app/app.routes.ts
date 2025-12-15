import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  // Redirección inicial al login
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },

  // Login (página pública)
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login.component').then(m => m.LoginComponent),
  },

  // Login (página pública)
  {
    path: 'recuperar-clave',
    loadComponent: () =>
      import('./components/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },

  // Dashboard
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },

  // Gestión de colaboradores
  {
    path: 'colaboradores',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion', 'practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/colaboradores/colaboradores.component').then(m => m.ColaboradoresComponent),
  },

  // Gestión de tutores
  {
    path: 'tutores',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion', 'practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/tutores/tutores.component').then(m => m.TutoresComponent),
  },

  // Gestión de usuarios
  {
    path: 'usuarios',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/usuarios/usuarios.component').then(m => m.UsuariosComponent),
  },

  // Gestión de estudiantes
  {
    path: 'estudiantes',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion', 'practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/estudiante/estudiante.component').then(m => m.EstudiantesComponent),
  },

  // Registro de encuestas
  {
    path: 'encuestas',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion'] },
    loadComponent: () =>
      import('./components/encuestas/encuestas.component').then(m => m.EncuestasComponent),
  },

  // Supervisión general
  {
    path: 'supervision',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/supervision/supervision.component').then(m => m.SupervisionComponent),
  },

  // Gestión de prácticas
  {
    path: 'practicas',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/practicas/practicas.component').then(m => m.PracticasComponent),
  },

  // Gestión de centros educativos
  {
    path: 'centros-educativos',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion', 'practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/centros-educativos/centros-educativos.component').then(m => m.CentrosEducativosComponent),
  },

  // Generación de carta de solicitud
  {
    path: 'carta',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/carta/carta.component').then(m => m.CartaComponent),
  },

  // Estudiantes en práctica (solo para jefatura de carrera)
  {
    path: 'estudiantes-en-practica',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/estudiantes-en-practica/estudiantes-en-practica.component').then(m => m.EstudiantesEnPracticaComponent),
  },

  // Actividades de estudiantes
  {
    path: 'actividades-estudiantes',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/actividades-estudiantes/actividades-estudiantes.component').then(m => m.ActividadesEstudiantesComponent),
  },

  // Ruta comodín → redirige a login
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
