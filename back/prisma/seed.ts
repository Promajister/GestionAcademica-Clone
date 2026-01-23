import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import e from 'express';

const prisma = new PrismaClient();

type RolClave = 'jefatura' | 'vinculacion' | 'practicas';
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

async function main() {
  // Solo lo mínimo para login (roles/permisos/usuarios)
  const plainPassword = '123456';
  const hashed = await bcrypt.hash(plainPassword, 10);

  const [rolJefatura, rolVinculacion, rolPracticas] = await seedRolesYPermisos();

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
  ]);

  await seedColaboradores();

  console.log('Seed OK: usuarios/roles/permisos/colaboradores.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
