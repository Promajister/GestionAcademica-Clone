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
    path: 'horario/salas',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'secretaria'] },
    loadComponent: () =>
      import('./components/horario-salas/horario-salas.component').then(m => m.HorarioSalasComponent),
  },
  {
    path: 'horario/asignaturas',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'secretaria'] },
    loadComponent: () =>
      import('./components/horario-asignaturas/horario-asignaturas.component').then(m => m.HorarioAsignaturasComponent),
  },
  {
    path: 'horario/grilla',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'secretaria'] },
    loadComponent: () =>
      import('./components/horario-grilla/horario-grilla-page.component').then(m => m.HorarioGrillaPageComponent),
  },
  {
    path: 'horario/bloques-protegidos',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'secretaria'] },
    loadComponent: () =>
      import(
        './components/horario-bloques-protegidos/horario-bloques-protegidos.component'
      ).then((m) => m.HorarioBloquesProtegidosComponent),
  },
  {
    path: 'horario/mi-disponibilidad',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['profesor'] },
    loadComponent: () =>
      import(
        './components/horario-disponibilidad/horario-disponibilidad.component'
      ).then((m) => m.HorarioDisponibilidadComponent),
  },
  {
    path: 'horario',
    pathMatch: 'full',
    redirectTo: 'horario/asignaturas',
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
    data: { roles: [ROLES.JEFATURA, ROLES.PRACTICAS, ROLES.VINCULACION] },
    loadComponent: () =>
      import('./components/reportes/reportes.component')
        .then(m => m.ReportesComponent)
  },

  {
    path: 'reportes/estudiante',
    canActivate: [authGuard, RoleGuard],
    data: { roles: [ROLES.JEFATURA, ROLES.PRACTICAS, ROLES.VINCULACION] },
    loadComponent: () =>
      import('./components/reportes-estudiantes/reportes-estudiantes.component')
        .then(m => m.ReportesEstudianteComponent),
  },

  {
    path: 'reportes/satisfaccion',
    canActivate: [authGuard, RoleGuard],
    data: { roles: [ROLES.JEFATURA, ROLES.PRACTICAS, ROLES.VINCULACION] },
    loadComponent: () =>
      import('./components/reportes-satisfaccion/reportes-satisfaccion.component')
        .then(m => m.ReportesSatisfaccionComponent),
  },


  {
    path: 'reportes/historico',
    canActivate: [authGuard, RoleGuard],
    data: { roles: [ROLES.JEFATURA, ROLES.PRACTICAS, ROLES.VINCULACION] },
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
    path: 'egresados/registro',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'vinculacion'] },
    loadComponent: () =>
      import('./components/egresados-registro/egresados-registro.component')
        .then(m => m.EgresadosRegistroComponent),
  },
  {
    path: 'egresados/actividades',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'vinculacion'], soloEgresados: true },
    loadComponent: () =>
      import('./components/actividades-estudiantes/actividades-estudiantes.component')
        .then(m => m.ActividadesEstudiantesComponent),
  },
  {
    path: 'egresados/encuestas',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'vinculacion'] },
    loadComponent: () =>
      import('./components/egresados-encuestas/egresados-encuestas.component')
        .then(m => m.EgresadosEncuestasComponent),
  },
  {
    path: 'egresados/encuestas-actividades',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'vinculacion'] },
    loadComponent: () =>
      import('./components/egresados-encuestas-actividades/egresados-encuestas-actividades.component')
        .then(m => m.EgresadosEncuestasActividadesComponent),
  },
  {
    path: 'egresados/analisis',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'vinculacion'] },
    loadComponent: () =>
      import('./components/egresados-analisis/egresados-analisis.component')
        .then(m => m.EgresadosAnalisisComponent),
  },
  {
    path: 'horario/carga-docente',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'secretaria'] },
    loadComponent: () =>
      import('./components/asignacion-carga/asignacion-carga.component').then(
        (m) => m.AsignacionCargaComponent,
      ),
  },
  {
    path: 'horario/profesores',
    canActivate: [authGuard, roleGuard],
    data: { allowedRoles: ['jefatura', 'secretaria'] },
    loadComponent: () =>
      import('./components/horario-profesores/horario-profesores.component')
        .then(m => m.HorarioProfesoresComponent),
  },

  {
    path: '**',
    redirectTo: 'dashboard',
  },

];
