import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { RoleGuard } from './guards/rol.guard';
import { ROLES } from './components/auth/roles';


export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },

  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login.component').then(m => m.LoginComponent),
  },

  {
    path: 'recuperar-clave',
    loadComponent: () =>
      import('./components/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },

  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },

  {
    path: 'mi-cuenta',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/mi-cuenta/mi-cuenta.component').then(m => m.MiCuentaComponent),
  },

  {
    path: 'colaboradores',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion', 'practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/colaboradores/colaboradores.component').then(m => m.ColaboradoresComponent),
  },

  {
    path: 'tutores',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion', 'practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/tutores/tutores.component').then(m => m.TutoresComponent),
  },

  {
    path: 'usuarios',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/usuarios/usuarios.component').then(m => m.UsuariosComponent),
  },

  {
    path: 'estudiantes',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion', 'practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/estudiante/estudiante.component').then(m => m.EstudiantesComponent),
  },

  {
    path: 'importar-estudiantes',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/importar-estudiantes/importar-estudiantes.component').then(m => m.ImportarEstudiantesComponent),
  },

  {
    path: 'encuestas',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion'] },
    loadComponent: () =>
      import('./components/encuestas/encuestas.component').then(m => m.EncuestasComponent),
  },

  {
    path: 'practicas',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/practicas/practicas.component').then(m => m.PracticasComponent),
  },

  {
    path: 'centros-educativos',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['vinculacion', 'practicas', 'jefatura'] },
    loadComponent: () =>
      import('./components/centros-educativos/centros-educativos.component').then(m => m.CentrosEducativosComponent),
  },

  {
    path: 'carta',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/carta/carta.component').then(m => m.CartaComponent),
  },

  {
    path: 'estudiantes-en-practica',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/estudiantes-en-practica/estudiantes-en-practica.component').then(m => m.EstudiantesEnPracticaComponent),
  },

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
    data: { roles: [ROLES.JEFATURA,ROLES.PRACTICAS] },
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
    data: { roles: [ROLES.JEFATURA, ROLES.PRACTICAS] },
    loadComponent: () =>
      import('./components/reportes-historico/reportes-historico.component')
        .then(m => m.ReportesHistoricoComponent),
  },

  {
    path: 'vinculacion/actividades-pm',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'vinculacion'] },
    loadComponent: () =>
      import('./components/actividades-pm/actividades-pm.component')
        .then(m => m.ActividadesPmComponent),
  },

  {
    path: 'vinculacion/actividades-pm/gestion',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'vinculacion'] },
    loadComponent: () =>
      import('./components/gestion/actividades-pm-gestion.component')
        .then(m => m.ActividadesPmGestionComponent),
  },

  {
    path: 'encuestas-vinculacion',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'vinculacion'] },
    loadComponent: () =>
      import('./components/encuesta-jefatura/encuestas-jefatura.component')
        .then(m => m.EncuestaJefaturaComponent),
  },
  {
    path: 'encuestas-jefatura',
    redirectTo: 'encuestas-vinculacion',
    pathMatch: 'full',
  },
  {
    path: 'egresados/ficha-digital',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/egresados-ficha-digital/egresados-ficha-digital.component')
        .then(m => m.EgresadosFichaDigitalComponent),
  },
  {
    path: 'egresados/registro',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/egresados-registro/egresados-registro.component')
        .then(m => m.EgresadosRegistroComponent),
  },
  {
    path: 'egresados/empleabilidad',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura'] },
    loadComponent: () =>
      import('./components/egresados-empleabilidad/egresados-empleabilidad.component')
        .then(m => m.EgresadosEmpleabilidadComponent),
  },

  {
    path: '**',
    redirectTo: 'dashboard',
  },

];
