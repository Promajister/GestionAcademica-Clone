import { PrismaClient, TipoSala, TipoDia, TipoOrigen, TipoCurso, AlcanceBloqueProtegido, TipoContrato } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import e from 'express';

const prisma = new PrismaClient();

type RolClave = 'jefatura' | 'vinculacion' | 'practicas' | 'secretaria';
type PermDef = { clave: string; descripcion: string };

async function ensureUsuario(
  email: string,
  hashedPassword: string,
  nombre: string,
  role: RolClave,
  rolId?: number,
) {
  return prisma.usuario.upsert({
    where: { email },
    update: {
      nombre,
      role,
      activo: true,
      rolId,
      // OJO: no actualizo password aquí para no pisarlo si ya existe
    },
    create: {
      email,
      password: hashedPassword,
      nombre,
      role,
      activo: true,
      rolId,
    },
  });
}

async function seedRolesYPermisos() {
  const roles = await prisma.$transaction([
    prisma.rol.upsert({
      where: { clave: 'jefatura' },
      update: { nombre: 'Jefatura de Carrera' },
      create: { clave: 'jefatura', nombre: 'Jefatura de Carrera' },
    }),
    prisma.rol.upsert({
      where: { clave: 'vinculacion' },
      update: { nombre: 'Coordinacion de Vinculacion' },
      create: { clave: 'vinculacion', nombre: 'Coordinacion de Vinculacion' },
    }),
    prisma.rol.upsert({
      where: { clave: 'practicas' },
      update: { nombre: 'Coordinacion de Practicas' },
      create: { clave: 'practicas', nombre: 'Coordinacion de Practicas' },
    }),
    // ADM-F04: secretaria del departamento, usuaria del módulo Horario
    prisma.rol.upsert({
      where: { clave: 'secretaria' },
      update: { nombre: 'Secretaria de Departamento' },
      create: { clave: 'secretaria', nombre: 'Secretaria de Departamento' },
    }),
  ]);

  const permisosDef: PermDef[] = [
    { clave: 'dashboard.ver', descripcion: 'Ver dashboard' },

    { clave: 'usuarios.leer', descripcion: 'Listar usuarios' },
    { clave: 'usuarios.crear', descripcion: 'Crear usuarios' },
    { clave: 'usuarios.editar', descripcion: 'Editar datos de usuario o rol' },
    { clave: 'usuarios.activar', descripcion: 'Activar/Desactivar usuarios' },
    { clave: 'usuarios.permisos', descripcion: 'Gestionar permisos de roles' },

    { clave: 'estudiantes.ver', descripcion: 'Ver estudiantes' },
    { clave: 'estudiantes.crear', descripcion: 'Crear estudiantes' },
    { clave: 'estudiantes.editar', descripcion: 'Editar estudiantes' },
    { clave: 'estudiantes.eliminar', descripcion: 'Eliminar estudiantes' },

    { clave: 'estudiantesEnPractica.ver', descripcion: 'Ver estudiantes en practica' },

    { clave: 'tutores.ver', descripcion: 'Ver tutores' },
    { clave: 'tutores.crear', descripcion: 'Crear tutores' },
    { clave: 'tutores.editar', descripcion: 'Editar tutores' },
    { clave: 'tutores.eliminar', descripcion: 'Eliminar tutores' },

    { clave: 'colaboradores.ver', descripcion: 'Ver colaboradores' },
    { clave: 'colaboradores.crear', descripcion: 'Crear colaboradores' },
    { clave: 'colaboradores.editar', descripcion: 'Editar colaboradores' },
    { clave: 'colaboradores.eliminar', descripcion: 'Eliminar colaboradores' },

    { clave: 'centros.ver', descripcion: 'Ver centros educativos' },
    { clave: 'centros.crear', descripcion: 'Crear centros educativos' },
    { clave: 'centros.editar', descripcion: 'Editar centros educativos' },
    { clave: 'centros.eliminar', descripcion: 'Eliminar centros educativos' },

    { clave: 'practicas.ver', descripcion: 'Ver practicas' },
    { clave: 'practicas.crear', descripcion: 'Crear practicas' },
    { clave: 'practicas.editar', descripcion: 'Editar practicas' },
    { clave: 'practicas.eliminar', descripcion: 'Eliminar practicas' },

    { clave: 'actividades.ver', descripcion: 'Ver actividades' },
    { clave: 'actividades.crear', descripcion: 'Crear actividades' },
    { clave: 'actividades.editar', descripcion: 'Editar actividades' },
    { clave: 'actividades.eliminar', descripcion: 'Eliminar actividades' },

    { clave: 'encuestas.ver', descripcion: 'Ver encuestas' },
    { clave: 'encuestas.crear', descripcion: 'Crear encuestas' },
    { clave: 'encuestas.editar', descripcion: 'Editar encuestas' },
    { clave: 'encuestas.eliminar', descripcion: 'Eliminar encuestas' },

    { clave: 'carta.ver', descripcion: 'Ver carta de solicitud' },
    { clave: 'carta.generar', descripcion: 'Generar carta de solicitud' },

    { clave: 'reportes.ver', descripcion: 'Ver reportes' },
  ];

  const permisosMap: Record<string, number> = {};

  for (const p of permisosDef) {
    const perm = await prisma.permiso.upsert({
      where: { clave: p.clave },
      update: { descripcion: p.descripcion },
      create: { clave: p.clave, descripcion: p.descripcion },
    });
    permisosMap[p.clave] = perm.id;
  }

  const permisosAll = Object.values(permisosMap).map((id) => ({ id }));

  const rolePerms: Record<RolClave, string[]> = {
    jefatura: Object.keys(permisosMap),
    vinculacion: [
      'dashboard.ver',
      'encuestas.ver',
      'encuestas.crear',
      'encuestas.editar',
      'encuestas.eliminar',
      'estudiantes.ver',
      'estudiantes.crear',
      'estudiantes.editar',
      'estudiantes.eliminar',
      'colaboradores.ver',
      'colaboradores.crear',
      'colaboradores.editar',
      'colaboradores.eliminar',
      'centros.ver',
      'centros.crear',
      'centros.editar',
      'centros.eliminar',
      'tutores.ver',
      'tutores.crear',
      'tutores.editar',
      'tutores.eliminar',
    ],
    practicas: [
      'dashboard.ver',
      'estudiantes.ver',
      'estudiantes.crear',
      'estudiantes.editar',
      'estudiantes.eliminar',
      'tutores.ver',
      'tutores.crear',
      'tutores.editar',
      'tutores.eliminar',
      'colaboradores.ver',
      'colaboradores.crear',
      'colaboradores.editar',
      'colaboradores.eliminar',
      'centros.ver',
      'centros.crear',
      'centros.editar',
      'centros.eliminar',
      'practicas.ver',
      'practicas.crear',
      'practicas.editar',
      'practicas.eliminar',
      'actividades.ver',
      'actividades.crear',
      'actividades.editar',
      'actividades.eliminar',
      'reportes.ver',
    ],
    secretaria: ['dashboard.ver'],
  };

  for (const r of roles) {
    const claves = rolePerms[r.clave as RolClave] ?? [];
    const toConnect = claves
      .map((c) => ({ id: permisosMap[c] }))
      .filter((c) => c.id);

    await prisma.rol.update({
      where: { id: r.id },
      data: {
        permisos: {
          set: [],
          connect: r.clave === 'jefatura' ? permisosAll : toConnect,
        },
      },
    });
  }

  return roles;
}

async function seedColaboradores() {
  const colaboradores = [
    { nombre: 'Etna Vivar', correo: 'etnavn2006@gmail.com' },
    { nombre: 'Alexis Fernández', correo: 'alexis.fernandezme@slepchinchorro.cl' },
    { nombre: 'Amalia Rojas', correo: 'amalia.Rojas.Varela@gmail.com' },
    { nombre: 'Ginnetta Villanueva', correo: 'ginnetta.villanueva.v@gmail.com' },
    { nombre: 'Maritza Gatica', correo: 'mgaticacoya@gmail.com' },
    { nombre: 'Katherina Araya', correo: 'karaya@colegiosaucache.cl' },
    { nombre: 'Juan Pablo León', correo: 'juan.leonan@slepchinchorro.cl' },
    { nombre: 'Edith Morales', correo: 'emorales@insucovalpo.cl' },
    { nombre: 'Gabriela Farias', correo: 'gabriela.gahona@liceoavb.cl' },
    { nombre: 'Daniela Maya', correo: 'daniela.mayase@slepchinchorro.cl' },
    { nombre: 'Leonor Calderon', correo: 'leitoantu@gmail.com' },
    { nombre: 'Katherine Vega', correo: 'katherine.vegaro@slepchinchorro.cl' },
    { nombre: 'Jonathan Escobar', correo: 'jonathan.escobarri@slepchinchorro.cl' },
    { nombre: 'Leslie Poblete', correo: 'leslie.poblete@aricacollege.cl' },
    { nombre: 'Profesora Claudia Campos', correo: 'claudia.campos@aricacollege.cl' },
    { nombre: 'Maryori Ferrerira', correo: 'mferreira@fesma.cl' },
    { nombre: 'Viviana Yáñez Quevedo', correo: 'viviana.yanez.quevedo@ccrsha.cl' },
    { nombre: 'Maykoll Gamonal', correo: 'm.gamonal@juanpablosegundo.cl' },
    { nombre: 'Arantzazú Ardiles', correo: 'a.ardilesvilla@gmail.com' },
    { nombre: 'Mauricio Fuentes', correo: 'mauricio.fuentes@cisa-arica.cl' },
    { nombre: 'Cristian Jelves', correo: 'c.jelves@colegioabo.cl' },
    { nombre: 'Ivania Reyes', correo: 'ireyes@colegioaltacordillera.cl' },
    { nombre: 'William Espinoza', correo: 'wespinoza@colegiosaucache.cl' },
    { nombre: 'Monserrat Casas', correo: 'mcasas@colegioaltacordillera.cl' },
    { nombre: 'Andrea Alfaro', correo: 'andreaalfaro.t@dsarica.cl' },
    { nombre: 'Ayelen Simpertigue', correo: 'a.simpertigue@colegioabo.cl' },
  ];

  const seen = new Set<string>();

  for (const item of colaboradores) {
    const nombre = item.nombre.trim();
    const correo = item.correo.trim();
    const key = `${correo.toLowerCase()}|${nombre.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const existing = await prisma.colaborador.findFirst({
      where: { nombre, correo },
    });

    if (!existing) {
      await prisma.colaborador.create({
        data: { nombre, correo },
      });
    }
  }
}

async function seedCentrosEducativos() {
  await prisma.centroEducativo.createMany({
    data: [
      {
        nombre: 'Archivo Histórico Vicente Dagnino',
        tipo: 'SLEP',
        direccion: '5to Piso Biblioteca Central Universidad de Tarapacá',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Colegio Alemán Arica',
        tipo: 'PARTICULAR_SUBVENCIONADO',
        direccion: 'Av. Senador Humberto Palza Corvacho 3727',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Colegio Bicentenario Miramar',
        tipo: 'PARTICULAR_SUBVENCIONADO',
        direccion: 'San Ignacio de Loyola 750',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Colegio Centenario de Arica',
        tipo: 'SLEP',
        direccion: 'Av. El Roble 4016',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Colegio Chile Norte',
        tipo: 'PARTICULAR_SUBVENCIONADO',
        direccion: 'Linderos 3650',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Colegio Ford College',
        tipo: 'PARTICULAR_SUBVENCIONADO',
        direccion: 'Calle Menandro Urrutia 2311',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Colegio Integrado Eduardo Frei Montalva',
        tipo: 'SLEP',
        direccion: 'San Marcos 611',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Colegio Saucache',
        tipo: 'PARTICULAR_SUBVENCIONADO',
        direccion: 'Los Flamencos 024',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Colegio Tecnológico Don Bosco',
        tipo: 'PARTICULAR_SUBVENCIONADO',
        direccion: 'Capitán Ávalos 2606',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Escuela América',
        tipo: 'SLEP',
        direccion: 'Av. Balmaceda 2450',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Escuela Manuel Rodríguez Erdozya',
        tipo: 'SLEP',
        direccion: 'Av. Balmaceda 2450',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Escuela República de Francia',
        tipo: 'SLEP',
        direccion: 'María Lilia del Pino 728',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Escuela República de Israel',
        tipo: 'SLEP',
        direccion: 'Magallanes 1860',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Escuela Rómulo Peña Maturana',
        tipo: 'SLEP',
        direccion: 'Las Acacias 2099',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Juan Pablo Segundo',
        tipo: 'PARTICULAR_SUBVENCIONADO',
        direccion: 'San Marcos 57',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Liceo Bicentenario Antonio Varas de la Barra',
        tipo: 'SLEP',
        direccion: 'Av. Loa 2200',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Liceo Bicentenario Artístico Dr. Juan Noé Crevani',
        tipo: 'SLEP',
        direccion: 'Barros Arana 2154',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Liceo Bicentenario Jovino Naranjo Fernández',
        tipo: 'SLEP',
        direccion: 'Dr. Juan Noé 555',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'Liceo Octavio Palma Pérez',
        tipo: 'SLEP',
        direccion: 'Avenida Santa María 1697',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
      {
        nombre: 'North American College',
        tipo: 'PARTICULAR_SUBVENCIONADO',
        direccion: 'Rafael Sotomayor 754',
        comuna: 'Arica',
        region: 'Arica y Parinacota',
      },
    ],
  });
}

async function main() {
  // Solo lo mínimo para login (roles/permisos/usuarios)
  const plainPassword = '123456';
  const hashed = await bcrypt.hash(plainPassword, 10);

  const [rolJefatura, rolVinculacion, rolPracticas, rolSecretaria] =
    await seedRolesYPermisos();

  await Promise.all([
    ensureUsuario(
      'pedhg@gestion.uta.cl',
      hashed,
      'Johana Rojas',
      'jefatura',
      rolJefatura.id,
    ),
    ensureUsuario(
      'cpalomoc@gestion.uta.cl',
      hashed,
      'Claudia Palomo',
      'vinculacion',
      rolVinculacion.id,
    ),
    ensureUsuario(
      'practicas.hg@gestion.uta.cl',
      hashed,
      'Carolina Quintana',
      'practicas',
      rolPracticas.id,
    ),
    ensureUsuario(
      'jc_pedhg@gestion.uta.cl',
      hashed,
      'Ignacio Jara',
      'jefatura',
      rolJefatura.id,
    ),
    // Secretarias del departamento (contraparte del módulo Horario)
    ensureUsuario('johana.hg@gestion.uta.cl', hashed, 'Johana', 'secretaria', rolSecretaria.id),
    ensureUsuario('karen.hg@gestion.uta.cl', hashed, 'Karen Catalán', 'secretaria', rolSecretaria.id),
  ]);

  await seedColaboradores();
  await seedCentrosEducativos();
  await seedHorario();
  await seedProfesoresDemo(hashed);

  console.log('Seed OK: usuarios/roles/permisos/colaboradores/centros/horario.');
}

// ---------- PROFESORES DEMO (DIS-F02) ----------
// Perfil "profesor" + un docente por horas y uno de planta para probar
// la pantalla "Mi disponibilidad". Idempotente: no pisa contraseñas existentes.
async function seedProfesoresDemo(hashedPassword: string) {
  const rolProfesor = await prisma.rol.upsert({
    where: { clave: 'profesor' },
    update: { nombre: 'Profesor' },
    create: { clave: 'profesor', nombre: 'Profesor' },
  });

  const docentes: { email: string; nombre: string; contrato: TipoContrato }[] = [
    { email: 'profesor.horas@gestion.uta.cl', nombre: 'Docente Por Horas', contrato: TipoContrato.HORAS },
    { email: 'profesor.horas2@gestion.uta.cl', nombre: 'Docente Por Horas 2', contrato: TipoContrato.HORAS },
    { email: 'profesor.planta@gestion.uta.cl', nombre: 'Docente De Planta', contrato: TipoContrato.PLANTA },
  ];

  for (const d of docentes) {
    const usuario = await prisma.usuario.upsert({
      where: { email: d.email },
      update: { nombre: d.nombre, role: 'profesor', activo: true, rolId: rolProfesor.id },
      create: {
        email: d.email,
        password: hashedPassword,
        nombre: d.nombre,
        role: 'profesor',
        activo: true,
        rolId: rolProfesor.id,
      },
    });
    await prisma.profesor.upsert({
      where: { id_usuario: usuario.id },
      update: { contrato: d.contrato },
      create: { id_usuario: usuario.id, contrato: d.contrato },
    });
  }
}

// ---------- MÓDULO HORARIO ----------
async function seedHorario() {

  // Tabla SALA
  // ADM-F01-T4: 6 salas oficiales del departamento
  const salas: { id_sala: number; nombre: string; tipo: TipoSala; capacidad: number }[] = [
    { id_sala: 1, nombre: 'Sala 121', tipo: TipoSala.CLASES, capacidad: 22 },
    { id_sala: 2, nombre: 'Sala 104', tipo: TipoSala.CLASES, capacidad: 22 },
    { id_sala: 3, nombre: 'Sala 319', tipo: TipoSala.CLASES, capacidad: 22 },
    { id_sala: 4, nombre: 'Sala multifunción', tipo: TipoSala.CLASES, capacidad: 22 },
    { id_sala: 5, nombre: 'Sala Núcleo', tipo: TipoSala.REUNIONES, capacidad: 10 },
    { id_sala: 6, nombre: 'Sala de Consejo', tipo: TipoSala.REUNIONES, capacidad: 12 },
  ];

  for (const sala of salas) {
    await prisma.sala.upsert({
      where: { id_sala: sala.id_sala },
      update: {nombre: sala.nombre, tipo: sala.tipo, capacidad: sala.capacidad },
      create: { id_sala: sala.id_sala, nombre: sala.nombre, tipo: sala.tipo, capacidad: sala.capacidad },
    });
  }

  // Tabla DIA

  const dias: { id_dia: number; nombre: TipoDia }[] = [
    { id_dia: 1, nombre: TipoDia.LUNES },
    { id_dia: 2, nombre: TipoDia.MARTES },
    { id_dia: 3, nombre: TipoDia.MIERCOLES },
    { id_dia: 4, nombre: TipoDia.JUEVES },
    { id_dia: 5, nombre: TipoDia.VIERNES },
    { id_dia: 6, nombre: TipoDia.SABADO },
    { id_dia: 7, nombre: TipoDia.DOMINGO },
  ];

  for (const dia of dias) {
    await prisma.dia.upsert({
      where: { id_dia: dia.id_dia },
      update: { nombre: dia.nombre },
      create: { id_dia: dia.id_dia, nombre: dia.nombre },
    });
  }

  // Tabla BLOQUEHORARIO

  const bloques: { id_bloque: number; hora_inicio: string; hora_fin: string }[] = [
    { id_bloque: 1, hora_inicio: '08:00', hora_fin: '08:45' },
    { id_bloque: 2, hora_inicio: '08:45', hora_fin: '09:30' },
    { id_bloque: 3, hora_inicio: '09:40', hora_fin: '10:25' },
    { id_bloque: 4, hora_inicio: '10:25', hora_fin: '11:10' },
    { id_bloque: 5, hora_inicio: '11:20', hora_fin: '12:05' },
    { id_bloque: 6, hora_inicio: '12:05', hora_fin: '12:50' },
    { id_bloque: 7, hora_inicio: '14:45', hora_fin: '15:30' },
    { id_bloque: 8, hora_inicio: '15:30', hora_fin: '16:15' },
    { id_bloque: 9, hora_inicio: '16:20', hora_fin: '17:05' },
    { id_bloque: 10, hora_inicio: '17:05', hora_fin: '17:50' },
    { id_bloque: 11, hora_inicio: '17:55', hora_fin: '18:40' },
    { id_bloque: 12, hora_inicio: '18:40', hora_fin: '19:25' },
  ]

  for (const bloque of bloques) {
    await prisma.bloqueHorario.upsert({
      where: { id_bloque: bloque.id_bloque },
      update: { horaInicio: bloque.hora_inicio, horaFin: bloque.hora_fin },
      create: { id_bloque: bloque.id_bloque, horaInicio: bloque.hora_inicio, horaFin: bloque.hora_fin },
    });
  }
  // Tabla BLOQUEPROTEGIDO

  const protegidosSeed: {
    nombre: string;
    alcance: AlcanceBloqueProtegido;
    nombreDia: TipoDia;
    horaInicio: string;
  }[] = [
    // Horario protegido institucional (Reunión 1 y seed original de Isaac)
    { nombre: 'Horario protegido', alcance: AlcanceBloqueProtegido.UNIVERSIDAD, nombreDia: TipoDia.MARTES, horaInicio: '11:20' },
    { nombre: 'Horario protegido', alcance: AlcanceBloqueProtegido.UNIVERSIDAD, nombreDia: TipoDia.MARTES, horaInicio: '12:05' },
    { nombre: 'Horario protegido', alcance: AlcanceBloqueProtegido.UNIVERSIDAD, nombreDia: TipoDia.MIERCOLES, horaInicio: '11:20' },
    { nombre: 'Horario protegido', alcance: AlcanceBloqueProtegido.UNIVERSIDAD, nombreDia: TipoDia.MIERCOLES, horaInicio: '12:05' },
    { nombre: 'Horario protegido', alcance: AlcanceBloqueProtegido.UNIVERSIDAD, nombreDia: TipoDia.JUEVES, horaInicio: '16:20' },
    { nombre: 'Horario protegido', alcance: AlcanceBloqueProtegido.UNIVERSIDAD, nombreDia: TipoDia.JUEVES, horaInicio: '17:05' },
    // Consejo de profesores (Reunión 1: lunes bloques 9 y 10)
    { nombre: 'Consejo de profesores', alcance: AlcanceBloqueProtegido.ACADEMICOS, nombreDia: TipoDia.LUNES, horaInicio: '16:20' },
    { nombre: 'Consejo de profesores', alcance: AlcanceBloqueProtegido.ACADEMICOS, nombreDia: TipoDia.LUNES, horaInicio: '17:05' },
  ];

  for (const b of protegidosSeed) {
    const dia = await prisma.dia.findFirst({ where: { nombre: b.nombreDia } });
    const bloqueHorario = await prisma.bloqueHorario.findFirst({ where: { horaInicio: b.horaInicio } });

    if (dia && bloqueHorario) {
      const existente = await prisma.bloqueProtegido.findFirst({
        where: {
          nombre: b.nombre,
          alcance: b.alcance,
          id_dia: dia.id_dia,
          id_bloque: bloqueHorario.id_bloque,
        },
      });
      if (!existente) {
        await prisma.bloqueProtegido.create({
          data: {
            nombre: b.nombre,
            alcance: b.alcance,
            id_dia: dia.id_dia,
            id_bloque: bloqueHorario.id_bloque,
          },
        });
      }
    }
  }

  // Tabla CARRERA
  // ADM-F02-T1: carreras 311 y 336 con sus planes vigentes (según las mallas oficiales)
  
  const carreras: { codigo: string; nombre: string }[] = [
    { codigo: '311', nombre: 'PEDAGOGÍA EN HISTORIA, GEOGRAFÍA Y CIENCIAS SOCIALES' },
    { codigo: '336', nombre: 'LICENCIATURA EN HISTORIA Y GEOGRAFÍA'}
  ];

  for (const carrera of carreras) {
    await prisma.carrera.upsert({
      where: { codigo: carrera.codigo },
      update: { nombre: carrera.nombre },
      create: { codigo: carrera.codigo, nombre: carrera.nombre },
    });
  } 

  // Tabla PLAN
  
  const planes: {id_plan: number; year: number, version: string, codigo_carrera: string}[] = [
    { id_plan: 1, year: 2016, version: '3', codigo_carrera: '311' },
    { id_plan: 2, year: 2025, version: '1', codigo_carrera: '311' },
    { id_plan: 3, year: 2005, version: '3', codigo_carrera: '336' },
  ];

  for (const plan of planes) {
    await prisma.plan.upsert({
      where: { id_plan: plan.id_plan },
      update: { year: plan.year, version: plan.version, codigo_carrera: plan.codigo_carrera },
      create: { id_plan: plan.id_plan, year: plan.year, version: plan.version, codigo_carrera: plan.codigo_carrera },
    })
  }

  // Tabla ASIGNATURA y MALLA

  // Plan 2025 PHGCS
  const asignaturasPGHCS2025 = [
    // Semestre 1
    { codigo: 'DU038', nombre: 'ALFABETIZACION ACADEMICA Y TAC', catedraSemanal: 0, tallerSemanal: 2, labSemanal: 2, origen: TipoOrigen.EXTERNA, semestre: 1 },
    { codigo: 'HG068', nombre: 'INTRODUCCION A LA HISTORIA', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },
    { codigo: 'HG069', nombre: 'INTRODUCCION A LAS CIENCIAS SOCIALES', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },
    { codigo: 'HG070', nombre: 'INTRODUCCION AL PENSAMIENTO GEOGRAFICO', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },
    { codigo: 'HG075', nombre: 'LECTURA Y ESCRITURA ACADEMICA', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },

    // Semestre 2
    { codigo: 'DU042', nombre: 'LABOR DOCENTE Y EDUCACION EN CHILE', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 2 },
    { codigo: 'HG076', nombre: 'ETNOHISTORIA', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },
    { codigo: 'HG077', nombre: 'MUNDO ANTIGUO Y SU LEGADO', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },
    { codigo: 'HG078', nombre: 'GEOGRAFIA FISICA', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },
    { codigo: 'HG079', nombre: 'ECONOMIA Y SOCIEDAD', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },
    { codigo: 'DU113', nombre: 'PRACTICA PROFESIONAL DE APOYO A LA DOCENCIA I', catedraSemanal: 0, tallerSemanal: 2, labSemanal: 2, origen: TipoOrigen.EXTERNA, semestre: 2 },

    // Semestre 3
    { codigo: 'DU084', nombre: 'SOCIEDAD, CULTURA Y EDUCACION', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 3 },
    { codigo: 'HG080', nombre: 'HISTORIA MEDIEVAL', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 3 },
    { codigo: 'HG083', nombre: 'HISTORIA DE AMERICA Y CHILE COLONIAL', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 3 },
    { codigo: 'HG084', nombre: 'FORMACION CIUDADANA Y DEMOCRACIA', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 3 },
    { codigo: 'HG085', nombre: 'GEOGRAFIA HUMANA', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 3 },
    { codigo: 'FP162', nombre: 'PSICOLOGIA DEL DESARROLLO', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 3 },

    // Semestre 4
    { codigo: 'DU087', nombre: 'TEORIAS DEL APRENDIZAJE Y NEUROEDUCACION', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 4 },
    { codigo: 'HG086', nombre: 'HISTORIA MODERNA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 4 },
    { codigo: 'HG087', nombre: 'HISTORIA DE AMERICA SIGLO XIX', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 4 },
    { codigo: 'HG088', nombre: 'CARTOGRAFIA Y ANALISIS ESPACIAL', catedraSemanal: 2, tallerSemanal: 0, labSemanal: 4, origen: TipoOrigen.INTERNA, semestre: 4 },
    { codigo: 'XX027', nombre: 'ELECTIVO DE FORMACION GENERAL I', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 4 },
    { codigo: 'DU114', nombre: 'PRACTICA PROFESIONAL DE APOYO A LA DOCENCIA II', catedraSemanal: 0, tallerSemanal: 2, labSemanal: 4, origen: TipoOrigen.EXTERNA, semestre: 4 },

    // Semestre 5
    { codigo: 'DU092', nombre: 'GESTION E INNOVACION EN EL SISTEMA ESCOLAR', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 5 },
    { codigo: 'DU093', nombre: 'DIDACTICA', catedraSemanal: 2, tallerSemanal: 4, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 5 },
    { codigo: 'HG089', nombre: 'HISTORIA UNIVERSAL SIGLO XIX', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },
    { codigo: 'HG090', nombre: 'NATURALEZA Y SOCIEDAD', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },
    { codigo: 'DU115', nombre: 'PRACTICA PROFESIONAL DE APOYO A LA DOCENCIA III', catedraSemanal: 0, tallerSemanal: 2, labSemanal: 6, origen: TipoOrigen.EXTERNA, semestre: 5 },

    // Semestre 6
    { codigo: 'DU096', nombre: 'INCLUSION Y DIVERSIDAD EN EDUCACION', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 6 },
    { codigo: 'DU097', nombre: 'EVALUACION EDUCATIVA', catedraSemanal: 2, tallerSemanal: 4, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 6 },
    { codigo: 'HG099', nombre: 'HISTORIA DE CHILE SIGLO XIX', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'HG109', nombre: 'INVESTIGACION E INDAGACION APLICADA', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'HG116', nombre: 'GEOGRAFIA DE AMERICA Y CHILE', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'FP163', nombre: 'PSICOLOGIA EDUCATIVA', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 6 },

    // Semestre 7
    { codigo: 'DU100', nombre: 'INVESTIGACION EN EDUCACION', catedraSemanal: 0, tallerSemanal: 4, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 7 },
    { codigo: 'HG117', nombre: 'HISTORIA UNIVERSAL CONTEMPORANEA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'HG118', nombre: 'HISTORIA DE AMERICA CONTEMPORANEA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'HG119', nombre: 'DIDACTICA DE LA HISTORIA Y LAS CIENCIAS SOCIALES', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'HG124', nombre: 'GEOGRAFIA URBANA Y RURAL', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'DU116', nombre: 'PRACTICA PROFESIONAL DE APOYO A LA DOCENCIA IV', catedraSemanal: 0, tallerSemanal: 2, labSemanal: 8, origen: TipoOrigen.EXTERNA, semestre: 7 },

    // Semestre 8
    { codigo: 'DU104', nombre: 'ACTIVIDAD DE GRADO', catedraSemanal: 0, tallerSemanal: 4, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 8 },
    { codigo: 'HG125', nombre: 'HISTORIA DE CHILE CONTEMPORANEA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },
    { codigo: 'HG126', nombre: 'DERECHOS HUMANOS Y VIDA EN SOCIEDAD', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },
    { codigo: 'HG127', nombre: 'DIDACTICA DE LA GEOGRAFIA', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },
    { codigo: 'HG128', nombre: 'ORGANIZACION TERRITORIAL Y AMBIENTAL', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },

    // Semestre 9
    { codigo: 'XX028', nombre: 'ELECTIVO DE FORMACION GENERAL II', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'HG129', nombre: 'CAMBIO GLOBAL', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'HG134', nombre: 'DIVERSIDAD Y PROCESOS SOCIALES CONTEMPORANEOS', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'HG135', nombre: 'TALLER DE FORMULACION DE PROYECTOS', catedraSemanal: 2, tallerSemanal: 4, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'HG136', nombre: 'HISTORIA Y GEOGRAFIA DEL NORTE GRANDE', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },

    // Semestre 10
    { codigo: 'HG137', nombre: 'PRACTICA PROFESIONAL', catedraSemanal: 0, tallerSemanal: 2, labSemanal: 18, origen: TipoOrigen.INTERNA, semestre: 10 },
    { codigo: 'HG138', nombre: 'ACTIVIDAD DE TITULACION', catedraSemanal: 0, tallerSemanal: 4, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 10 },
  ];

  let i = 1

  for (const asig of asignaturasPGHCS2025) {
    await prisma.asignatura.upsert({
      where: { codigo: asig.codigo },
      update: {
        nombre: asig.nombre,
        catedraSemanal: asig.catedraSemanal,
        tallerSemanal: asig.tallerSemanal,
        labSemanal: asig.labSemanal,
        origen: asig.origen,
      },
      create: {
        codigo: asig.codigo,
        nombre: asig.nombre,
        catedraSemanal: asig.catedraSemanal,
        tallerSemanal: asig.tallerSemanal,
        labSemanal: asig.labSemanal,
        origen: asig.origen
      }
    });

    await prisma.malla.upsert({
      where: { id_malla: i },
      update: { 
        semestre: asig.semestre,
        id_plan: planes[1].id_plan,
        codigo_asignatura: asig.codigo
       },
      create: { id_malla: i,id_plan: planes[1].id_plan, codigo_asignatura: asig.codigo, semestre: asig.semestre }
    });

    i++;
  }

  // Plan 2016 PHG
  const asignaturasPHG2016 = [
    // Semestre 1
    { codigo: 'HG413', nombre: 'INTRODUCCION A LA HISTORIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },
    { codigo: 'HG414', nombre: 'CULTURA Y CIVILIZACIONES ANTIGUAS', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },
    { codigo: 'HG415', nombre: 'INTRODUCCION A LAS HUMANIDADES Y LAS CIENCIAS SOCIALES', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },
    { codigo: 'HG416', nombre: 'INTRODUCCION AL A GEOGRAFIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },
    { codigo: 'HG417', nombre: 'ESCRITURA Y LECTURA ACADEMICA Y DISCIPLINAR', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },
    { codigo: 'ED555', nombre: 'IDENTIDAD PROFESIONAL Y COMUNICACION', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 1 },

    // Semestre 2
    { codigo: 'HG418', nombre: 'ECONOMIA Y POLITICA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },
    { codigo: 'HG419', nombre: 'FORMACION DE LAS SOCIEDADES OCCIDENTALES', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },
    { codigo: 'HG420', nombre: 'TEORIA EL ESTADO Y LA SOCIEDAD', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },
    { codigo: 'HG421', nombre: 'GEOGRAFIA DE LA POBLACION', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },
    { codigo: 'ED559', nombre: 'EL ALUMNO Y SU ENTORNO SOCIAL', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 2 },
    { codigo: 'FP131', nombre: 'PSICOLOGIA EDUCACIONAL', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 2 },

    // Semestre 3
    { codigo: 'HG422', nombre: 'ETNOHISTORIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 3 },
    { codigo: 'HG423', nombre: 'GEOGRAFIA FISICA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 3 },
    { codigo: 'HG424', nombre: 'CARTOGRAFIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 3 },
    { codigo: 'ED564', nombre: 'APRENDIZAJE PROFUNDO Y DOCENCIA DE CALIDAD', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 3 },
    { codigo: 'ED693', nombre: 'ORIENTACION, MEDIACION Y JEFATURA DE CURSO', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 3 },
    { codigo: 'ED749', nombre: 'PRACTICA PROFESIONAL DE APOYO A LA DOCENCIA I', catedraSemanal: 2, tallerSemanal: 0, labSemanal: 2, origen: TipoOrigen.EXTERNA, semestre: 3 },

    // Semestre 4
    { codigo: 'HG426', nombre: 'HISTORIA MEDIEVAL', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 4 },
    { codigo: 'HG427', nombre: 'GLOBALIZACION Y MULTICULTURALIDAD', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 4 },
    { codigo: 'HG428', nombre: 'CLIMATOLOGIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 4 },
    { codigo: 'HG429', nombre: 'METODOLOGIA DE LA INVESTIGACION CUALITATIVA Y CUANTITATIVA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 4 },
    { codigo: 'ED568', nombre: 'PLANIFICACION Y SUS FUNDAMENTOS', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 4 },
    { codigo: 'ED710', nombre: 'LIDERAZGO Y COLABORACION PEDAGOGICA', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 4 },

    // Semestre 5
    { codigo: 'HG430', nombre: 'HISTORIA DE AMERICA COLONIAL', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },
    { codigo: 'HG431', nombre: 'HISTORIA MODERNA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },
    { codigo: 'HG432', nombre: 'HISTORIA DE CHILE COLONIAL', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },
    { codigo: 'HG433', nombre: 'GEOGRAFIA RURAL Y URBANA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },
    { codigo: 'HG434', nombre: 'GEOMORFOLOGIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },
    { codigo: 'ED556', nombre: 'USO DE TICS EN LA ENSEÑANZA', catedraSemanal: 0, tallerSemanal: 0, labSemanal: 4, origen: TipoOrigen.EXTERNA, semestre: 5 },

    // Semestre 6
    { codigo: 'HG435', nombre: 'HISTORIA DE AMERICA SIGLO XIX', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'HG436', nombre: 'HISTORIA UNIVERSAL CONTEMPORANEA SIGO XIX', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'HG437', nombre: 'HISTORIA POLITICA Y SOCIAL DE CHILE SIGLO XIX', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'HG438', nombre: 'GEOGRAFIA REGIONAL', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'HG439', nombre: 'MEDIO AMBIENTE Y SUSTENTABILIDAD', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'ED750', nombre: 'PRACTICA PROFESIONAL DE APOYO A LA DOCENCIA II', catedraSemanal: 2, tallerSemanal: 0, labSemanal: 4, origen: TipoOrigen.EXTERNA, semestre: 6 },

    // Semestre 7
    { codigo: 'HG441', nombre: 'HISTORIA DE AMERICA SIGLO XX', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'HG442', nombre: 'HISTORIA UNIVERSAL CONTEMPORANEA SIGO XX', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'HG443', nombre: 'GEOGRAFIA DE CHILE', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'ED695', nombre: 'INVESTIGACION EN LA ACCION EDUCATIVA', catedraSemanal: 2, tallerSemanal: 4, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 7 },
    { codigo: 'HG445', nombre: 'GEOGRAFIA DE AMERICA', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'ED694', nombre: 'EVALUACION EDUCATIVA', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 7 },

    // Semestre 8
    { codigo: 'HG139', nombre: 'TALLER DE ACTIVIDAD DE GRADO', catedraSemanal: 0, tallerSemanal: 6, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },
    { codigo: 'YY154', nombre: 'ELECTIVO DE ESPECIALIDAD EN HISTORIA Y GEOGRAFIA', catedraSemanal: 4, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },
    { codigo: 'HG094', nombre: 'FORMACION CIUDADANA Y DDHH', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },
    { codigo: 'ED722', nombre: 'DESARROLLO, DIAGNOSTICO E INCLUSION EDUCATIVA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 8 },
    { codigo: 'ED709', nombre: 'DESARROLLO ORGANIZACIONAL Y GESTION DE REDES', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 8 },
    { codigo: 'ED751', nombre: 'PRACTICA PROFESIONAL DE APOYO A LA DOCENCIA III', catedraSemanal: 0, tallerSemanal: 0, labSemanal: 6, origen: TipoOrigen.EXTERNA, semestre: 8 },

    // Semestre 9
    { codigo: 'HG444', nombre: 'GEOGRAFIA CULTURAL', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'HG450', nombre: 'GEOGRAFIA DE ZONAS ARIDAS Y DE MONTAÑA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'HG095', nombre: 'DIDACTICA DE HISTORIA', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'HG096', nombre: 'DIDACTICA DE LA GEOGRAFIA', catedraSemanal: 2, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'HG446', nombre: 'HISTORIA POLITICA Y SOCIAL DE CHILE SIGLO XX', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'HG141', nombre: 'TALLER DE HABILIDADES PEDAGOGICAS', catedraSemanal: 0, tallerSemanal: 2, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },

    // Semestre 10
    { codigo: 'ED752', nombre: 'PRACTICA PROFESIONAL', catedraSemanal: 0, tallerSemanal: 0, labSemanal: 22, origen: TipoOrigen.EXTERNA, semestre: 10 },
    { codigo: 'HG454', nombre: 'ACTIVIDAD DE TITULACION', catedraSemanal: 0, tallerSemanal: 4, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 10 },
  ];

  for (const asig of asignaturasPHG2016) {
    await prisma.asignatura.upsert({
      where: { codigo: asig.codigo },
      update: {
        nombre: asig.nombre,
        catedraSemanal: asig.catedraSemanal,
        tallerSemanal: asig.tallerSemanal,
        labSemanal: asig.labSemanal,
        origen: asig.origen
      },
      create: {
        codigo: asig.codigo,
        nombre: asig.nombre,
        catedraSemanal: asig.catedraSemanal,
        tallerSemanal: asig.tallerSemanal,
        labSemanal: asig.labSemanal,
        origen: asig.origen
      }
    });

    await prisma.malla.upsert({
      where: { id_malla: i },
      update: { 
        semestre: asig.semestre,
        codigo_asignatura: asig.codigo,
        id_plan: planes[0].id_plan
       },
      create: { 
        id_malla: i, 
        id_plan: planes[0].id_plan, 
        codigo_asignatura: asig.codigo, 
        semestre: asig.semestre }
    })

    i++;
  }

  // Plan LHG 2005

  const asignaturasLicenciatura = [
    // Semestre 1
    { codigo: 'HG251', nombre: 'INTRODUCCION A LAS CIENCIAS SOCIALES', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },
    { codigo: 'HG252', nombre: 'INTRODUCCION A LA HISTORIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },
    { codigo: 'HG253', nombre: 'INTRODUCCION A LA GEOGRAFIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },
    { codigo: 'HG254', nombre: 'TECNICAS DE GENERACION DE INFORMACION BASE', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },
    { codigo: 'HG417', nombre: 'ESCRITURA Y LECTURA ACADEMICA Y DISCIPLINAR', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 1 },

    // Semestre 2
    { codigo: 'HG050', nombre: 'ECONOMIA Y POLITICA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },
    { codigo: 'HG034', nombre: 'ORIGEN Y DIVERSIDAD DE LAS SOCIEDADES HUMANAS', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },
    { codigo: 'HG003', nombre: 'GEOGRAFIA FISICA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },
    { codigo: 'HG205', nombre: 'CARTOGRAFIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },
    { codigo: 'HG004', nombre: 'METODOLOGIA DE LA INVESTIGACION EN CIENCIAS SOCIALES', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 2 },

    // Semestre 3
    { codigo: 'HG255', nombre: 'HISTORIA UNIVERSAL', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 3 },
    { codigo: 'HG256', nombre: 'HISTORIA DE AMERICA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 3 },
    { codigo: 'HG257', nombre: 'MEDIO AMBIENTE', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 3 },
    { codigo: 'HG258', nombre: 'GEOGRAFIA HUMANA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 3 },
    { codigo: 'DI009', nombre: 'INGLES', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.EXTERNA, semestre: 3 },

    // Semestre 4
    { codigo: 'HG033', nombre: 'FUNDAMENTOS DE LA SOCIEDAD OCCIDENTAL', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 4 },
    { codigo: 'HG259', nombre: 'HISTORIA DE CHILE', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 4 },
    { codigo: 'HG260', nombre: 'GEOGRAFIA DE AMERICA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 4 },
    { codigo: 'HG261', nombre: 'GEOGRAFIA DE CHILE', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 4 },
    { codigo: 'HG262', nombre: 'GLOBALIZACION Y DESARROLLO', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 4 },

    // Semestre 5
    { codigo: 'HG263', nombre: 'HISTORIA MEDIEVAL', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },
    { codigo: 'HG264', nombre: 'ENCUENTRO DE CULTURAS', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },
    { codigo: 'HG265', nombre: 'GEODEMOGRAFIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },
    { codigo: 'HG266', nombre: 'CLIMATOLOGIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },
    { codigo: 'YY023', nombre: 'SEMINARIO DE HISTORIA', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },
    { codigo: 'YY024', nombre: 'SEMINARIO DE GEOGRAFÍA', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 5 },

    // Semestre 6
    { codigo: 'HG267', nombre: 'HISTORIA MODERNA', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'HG268', nombre: 'MUNDO COLONIAL DE AMERICA Y CHILE', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'HG269', nombre: 'GEOMORFOLOGIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'HG270', nombre: 'GEOGRAFIA RURAL Y URBANA', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'YY023', nombre: 'SEMINARIO DE HISTORIA', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },
    { codigo: 'YY024', nombre: 'SEMINARIO DE GEOGRAFÍA', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 6 },

    // Semestre 7
    { codigo: 'HG271', nombre: 'HISTORIA UNIVERSAL CONTEMPORANEA I', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'HG272', nombre: 'HISTORIA DE AMERICA Y CHILE CONTEMPORANEO I', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'HG273', nombre: 'GEOGRAFIA DE ZONAS ARIDAS Y DE MONTAÑA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'HG274', nombre: 'ESPACIOS REGIONALES DE CHILE', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'YY023', nombre: 'SEMINARIO DE HISTORIA', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },
    { codigo: 'YY024', nombre: 'SEMINARIO DE GEOGRAFÍA', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 7 },

    // Semestre 8
    { codigo: 'HG275', nombre: 'HISTORIA UNIVERSAL CONTEMPORANEA II', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },
    { codigo: 'HG276', nombre: 'HISTORIA DE AMERICA Y CHILE CONTEMPORANEO II', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },
    { codigo: 'HG057', nombre: 'FORMULACION Y EVALUACION DE PROYECTOS', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },
    { codigo: 'HG278', nombre: 'GEOGRAFIA CULTURAL', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },
    { codigo: 'YY023', nombre: 'SEMINARIO DE HISTORIA', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },
    { codigo: 'YY024', nombre: 'SEMINARIO DE GEOGRAFÍA', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 8 },

    // Semestre 9
    { codigo: 'HG407', nombre: 'PLANIFICACION TERRITORIAL', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'HG408', nombre: 'TELEDETECCION Y SISTEMAS DE INFORMACION GEOGRAFICA', catedraSemanal: 8, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'YY167', nombre: 'SEMINARIO ELECTIVO I', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'YY168', nombre: 'SEMINARIO ELECTIVO II', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'YY169', nombre: 'SEMINARIO ELECTIVO III', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'HG402', nombre: 'EPISTEMOLOGIA DE LA HISTORIA', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'YY026', nombre: 'SEMINARIO ELECTIVO II', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'YY171', nombre: 'SEMINARIO ELECTIVO III', catedraSemanal: 6, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },
    { codigo: 'YY170', nombre: 'SEMINARIO ELECTIVO IV', catedraSemanal: 4, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 9 },

    // Semestre 10
    { codigo: 'HG411', nombre: 'MEMORIA DE TITULO', catedraSemanal: 12, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 10 },
    { codigo: 'HG412', nombre: 'PRACTICA PROFESIONAL', catedraSemanal: 12, tallerSemanal: 0, labSemanal: 0, origen: TipoOrigen.INTERNA, semestre: 10 },
  ];

  for (const asignatura of asignaturasLicenciatura) {
    await prisma.asignatura.upsert({ 
      where: { codigo: asignatura.codigo },
      update: {
        nombre: asignatura.nombre,
        catedraSemanal: asignatura.catedraSemanal,
        tallerSemanal: asignatura.tallerSemanal,
        labSemanal: asignatura.labSemanal,
        origen: asignatura.origen
      },
      create: { 
        codigo: asignatura.codigo,
        nombre: asignatura.nombre,
        catedraSemanal: asignatura.catedraSemanal,
        tallerSemanal: asignatura.tallerSemanal,
        labSemanal: asignatura.labSemanal,
        origen: asignatura.origen
      },
    });

    await prisma.malla.upsert({
      where: { id_malla: i },
      update: {
        semestre: asignatura.semestre,
        id_plan: planes[2].id_plan,
        codigo_asignatura: asignatura.codigo
      }, 
      create: {
        id_malla: i,
        semestre: asignatura.semestre,
        id_plan: planes[2].id_plan,
        codigo_asignatura: asignatura.codigo
      }
    })

    i++;

  }

  // Cursos y Horarios Externos de demo (Plan 2025 v1, Carrera 311, Semestre 2)
  const mallaDU113 = await prisma.malla.findFirst({
    where: { codigo_asignatura: 'DU113', plan: { id_plan: 2 } },
  });
  const mallaDU042 = await prisma.malla.findFirst({
    where: { codigo_asignatura: 'DU042', plan: { id_plan: 2 } },
  });

  const diaLunes = await prisma.dia.findFirst({ where: { nombre: TipoDia.LUNES } });
  const diaMiercoles = await prisma.dia.findFirst({ where: { nombre: TipoDia.MIERCOLES } });

  const sala104 = await prisma.sala.findUnique({ where: { nombre: 'Sala 104' } });
  const sala121 = await prisma.sala.findUnique({ where: { nombre: 'Sala 121' } });

  if (mallaDU113 && diaLunes && diaMiercoles && sala104 && sala121) {
    let cursoDU113 = await prisma.curso.findFirst({
      where: { codigo_asignatura: 'DU113', id_malla: mallaDU113.id_malla, year: 2026, semestre: 2, grupo: 'A' },
    });
    if (!cursoDU113) {
      cursoDU113 = await prisma.curso.create({
        data: {
          tipo: TipoCurso.CATEDRA,
          grupo: 'A',
          inscritos: 22,
          year: 2026,
          semestre: 2,
          codigo_asignatura: 'DU113',
          id_malla: mallaDU113.id_malla,
        },
      });
    }

    const bloquesDU113 = [
      { id_curso: cursoDU113.id_curso, id_dia: diaMiercoles.id_dia, id_bloque: 3, id_sala: sala104.id_sala, sala_externa: null },
      { id_curso: cursoDU113.id_curso, id_dia: diaMiercoles.id_dia, id_bloque: 4, id_sala: sala104.id_sala, sala_externa: null },
      { id_curso: cursoDU113.id_curso, id_dia: diaLunes.id_dia, id_bloque: 9, id_sala: sala121.id_sala, sala_externa: null },
      { id_curso: cursoDU113.id_curso, id_dia: diaLunes.id_dia, id_bloque: 10, id_sala: sala121.id_sala, sala_externa: null },
    ];
    for (const b of bloquesDU113) {
      await prisma.horarioExterno.upsert({
        where: {
          id_curso_id_dia_id_bloque: {
            id_curso: b.id_curso,
            id_dia: b.id_dia,
            id_bloque: b.id_bloque,
          },
        },
        update: { id_sala: b.id_sala, sala_externa: b.sala_externa },
        create: b,
      });
    }
  }

  if (mallaDU042 && diaLunes && diaMiercoles) {
    let cursoDU042 = await prisma.curso.findFirst({
      where: { codigo_asignatura: 'DU042', id_malla: mallaDU042.id_malla, year: 2026, semestre: 2, grupo: 'A' },
    });
    if (!cursoDU042) {
      cursoDU042 = await prisma.curso.create({
        data: {
          tipo: TipoCurso.CATEDRA,
          grupo: 'A',
          inscritos: 22,
          year: 2026,
          semestre: 2,
          codigo_asignatura: 'DU042',
          id_malla: mallaDU042.id_malla,
        },
      });
    }

    const bloquesDU042 = [
      { id_curso: cursoDU042.id_curso, id_dia: diaLunes.id_dia, id_bloque: 11, id_sala: null, sala_externa: 'Sala Educación' },
      { id_curso: cursoDU042.id_curso, id_dia: diaLunes.id_dia, id_bloque: 12, id_sala: null, sala_externa: 'Sala Educación' },
      { id_curso: cursoDU042.id_curso, id_dia: diaMiercoles.id_dia, id_bloque: 11, id_sala: null, sala_externa: 'Sala Educación' },
      { id_curso: cursoDU042.id_curso, id_dia: diaMiercoles.id_dia, id_bloque: 12, id_sala: null, sala_externa: 'Sala Educación' },
    ];
    for (const b of bloquesDU042) {
      await prisma.horarioExterno.upsert({
        where: {
          id_curso_id_dia_id_bloque: {
            id_curso: b.id_curso,
            id_dia: b.id_dia,
            id_bloque: b.id_bloque,
          },
        },
        update: { id_sala: b.id_sala, sala_externa: b.sala_externa },
        create: b,
      });
    }
  }

  // ADM-F03: un curso (cátedra, grupo A) por cada asignatura propia de la malla,
  // con los mismos valores que crea AsignaturasService. Sin cursos no hay a quién asignar carga docente.
  // Idempotente: no toca las mallas que ya tienen curso.
  const mallasPropias = await prisma.malla.findMany({
    where: { asignatura: { origen: TipoOrigen.INTERNA }, cursos: { none: {} } },
  });
  if (mallasPropias.length) {
    await prisma.curso.createMany({
      data: mallasPropias.map((m) => ({
        tipo: TipoCurso.CATEDRA,
        grupo: 'A',
        inscritos: 22,
        year: 2026,
        semestre: m.semestre,
        codigo_asignatura: m.codigo_asignatura,
        id_malla: m.id_malla,
      })),
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
