import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { RoleGuard } from './guards/rol.guard';
import { ROLES } from './components/auth/roles';


export const routes: Routes = [
  // Redirecci�n inicial al dashboard
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },

  // Login (p�gina p�blica)
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login.component').then(m => m.LoginComponent),
  },

  // Recuperar clave (página pública)
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

  // Gesti�n de colaboradores
  // Mi cuenta
  {
    path: 'mi-cuenta',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/mi-cuenta/mi-cuenta.component').then(m => m.MiCuentaComponent),
  },

  // Gestión de colaboradores
  {
    path: 'colaboradores',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion', 'practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/colaboradores/colaboradores.component').then(m => m.ColaboradoresComponent),
  },

  // Gesti�n de tutores
  {
    path: 'tutores',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion', 'practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/tutores/tutores.component').then(m => m.TutoresComponent),
  },

  // Gesti�n de usuarios
  {
    path: 'usuarios',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/usuarios/usuarios.component').then(m => m.UsuariosComponent),
  },

  // Gesti�n de estudiantes
  {
    path: 'estudiantes',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion', 'practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/estudiante/estudiante.component').then(m => m.EstudiantesComponent),
  },

  // Importar estudiantes desde XLSX (solo jefatura)
  {
    path: 'importar-estudiantes',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/importar-estudiantes/importar-estudiantes.component').then(m => m.ImportarEstudiantesComponent),
  },

  // Registro de encuestas
  {
    path: 'encuestas',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion'] },
    loadComponent: () =>
      import('./components/encuestas/encuestas.component').then(m => m.EncuestasComponent),
  },

  // Supervision general


  // Gestión de prácticas
  {
    path: 'practicas',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/practicas/practicas.component').then(m => m.PracticasComponent),
  },

  // Gesti�n de centros educativos
  {
    path: 'centros-educativos',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion', 'practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/centros-educativos/centros-educativos.component').then(m => m.CentrosEducativosComponent),
  },

  // Generaci�n de carta de solicitud
  {
    path: 'carta',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/carta/carta.component').then(m => m.CartaComponent),
  },

  // Estudiantes en pr�ctica (solo para jefatura de carrera)
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

  {
    path: 'reportes',
    canActivate: [authGuard, RoleGuard],
    data: { roles: [ROLES.JEFATURA] },
    loadComponent: () =>
      import('./components/reportes/reportes.component')
        .then(m => m.ReportesComponent)
  },

   {
    path: 'reportes/estudiante',
    canActivate: [authGuard, RoleGuard],
    data: { roles: [ROLES.JEFATURA] },
    loadComponent: () =>
      import('./components/reportes-estudiantes/reportes-estudiantes.component')
        .then(m => m.ReportesEstudianteComponent),
  },

  {
    path: 'reportes/satisfaccion',
    canActivate: [authGuard, RoleGuard],
    data: { roles: [ROLES.JEFATURA] },
    loadComponent: () =>
      import('./components/reportes-satisfaccion/reportes-satisfaccion.component')
        .then(m => m.ReportesSatisfaccionComponent),
  },


  {
    path: 'reportes/historico',
    canActivate: [authGuard, RoleGuard],
    data: { roles: [ROLES.JEFATURA] },
    loadComponent: () =>
      import('./components/reportes-historico/reportes-historico.component')
        .then(m => m.ReportesHistoricoComponent),
  },

  // Ruta comodín → redirige a login
  {
    path: '**',
    redirectTo: 'dashboard',
  },

];
