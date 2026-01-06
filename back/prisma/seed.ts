import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type RolClave = 'jefatura' | 'vinculacion' | 'practicas';

type PermDef = {
  clave: string;
  descripcion: string;
};

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
  // ===== ROLES =====
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

  // ===== PERMISOS =====
  const permisosDef: PermDef[] = [
    { clave: 'dashboard.ver', descripcion: 'Ver dashboard' },

    { clave: 'usuarios.leer', descripcion: 'Listar usuarios' },
    { clave: 'usuarios.crear', descripcion: 'Crear usuarios' },
    { clave: 'usuarios.editar', descripcion: 'Editar usuarios' },
    { clave: 'usuarios.activar', descripcion: 'Activar/Desactivar usuarios' },
    { clave: 'usuarios.permisos', descripcion: 'Gestionar permisos de roles' },

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

  // ===== ASIGNACIÓN DE PERMISOS =====
  const permisosAll = Object.values(permisosMap).map((id) => ({ id }));

  for (const r of roles) {
    await prisma.rol.update({
      where: { id: r.id },
      data: {
        permisos: {
          set: [],
          connect: permisosAll,
        },
      },
    });
  }

  return roles;
}

async function main() {
  // ===== PASSWORD BASE PARA LOGIN =====
  const plainPassword = '123456';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // ===== ROLES Y PERMISOS =====
  const [rolJefatura, rolVinculacion, rolPracticas] =
    await seedRolesYPermisos();

  // ===== USUARIOS =====
  await Promise.all([
    ensureUsuario(
      'jefatura@uta.cl',
      hashedPassword,
      'Jefatura de Carrera',
      'jefatura',
      rolJefatura.id,
    ),
    ensureUsuario(
      'vinculacion@uta.cl',
      hashedPassword,
      'Coordinacion de Vinculacion',
      'vinculacion',
      rolVinculacion.id,
    ),
    ensureUsuario(
      'practicas@uta.cl',
      hashedPassword,
      'Coordinacion de Practicas',
      'practicas',
      rolPracticas.id,
    ),
  ]);

  console.log('Seed ejecutado: roles, permisos y usuarios creados');
}

main()
  .catch((error) => {
    console.error('Error ejecutando seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
