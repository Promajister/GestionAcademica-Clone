import { PrismaClient, TipoPregunta } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type RolClave = 'jefatura' | 'vinculacion' | 'practicas';

type PermDef = { clave: string; descripcion: string };

async function ensureEstudiante(rut: string, nombre: string) {
  return prisma.estudiante.upsert({
    where: { rut },
    update: { nombre },
    create: { rut, nombre },
  });
}

async function ensureCentro(nombre: string, comuna?: string, region?: string) {
  const existing = await prisma.centroEducativo.findFirst({
    where: { nombre },
  });
  if (existing) return existing;
  return prisma.centroEducativo.create({
    data: { nombre, comuna, region },
  });
}

async function ensureTutor(rut: string, nombre: string) {
  return prisma.tutor.upsert({
    where: { rut },
    update: { nombre },
    create: { rut, nombre },
  });
}

async function ensureColaborador(rut: string, nombre: string) {
  return prisma.colaborador.upsert({
    where: { rut },
    update: { nombre },
    create: { rut, nombre },
  });
}

async function ensurePregunta(
  descripcion: string,
  tipo: TipoPregunta,
  alternativas?: { descripcion: string; puntaje: number }[],
) {
  let pregunta = await prisma.pregunta.findFirst({ where: { descripcion } });
  if (!pregunta) {
    pregunta = await prisma.pregunta.create({
      data: { descripcion, tipo },
    });
  }

  if (tipo === 'CERRADA' && alternativas?.length) {
    for (const alt of alternativas) {
      const existingAlt = await prisma.alternativa.findFirst({
        where: { preguntaId: pregunta.id, descripcion: alt.descripcion },
      });
      if (!existingAlt) {
        await prisma.alternativa.create({
          data: {
            descripcion: alt.descripcion,
            puntaje: alt.puntaje,
            preguntaId: pregunta.id,
          },
        });
      }
    }
  }

  return pregunta;
}

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

  // Conectar permisos a cada rol
  for (const r of roles) {
    const claves = rolePerms[r.clave as RolClave] ?? [];
    const toConnect = claves.map((c) => ({ id: permisosMap[c] })).filter((c) => c.id);

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

async function main() {
  // ====== USUARIOS PARA LOGIN ======
  const plainPassword = '123456';
  const hashed = await bcrypt.hash(plainPassword, 10);

  const [rolJefatura, rolVinculacion, rolPracticas] = await seedRolesYPermisos();

  await Promise.all([
    ensureUsuario(
      'jefatura@uta.cl',
      hashed,
      'Jefatura de Carrera',
      'jefatura',
      rolJefatura.id,
    ),
    ensureUsuario(
      'vinculacion@uta.cl',
      hashed,
      'Coordinacion de Vinculacion',
      'vinculacion',
      rolVinculacion.id,
    ),
    ensureUsuario(
      'practicas@uta.cl',
      hashed,
      'Coordinacion de Practicas',
      'practicas',
      rolPracticas.id,
    ),
  ]);

  console.log('Usuarios para login creados/actualizados');

  // ====== (encuestas demo, etc.) ======
  const [est1] = await Promise.all([
    ensureEstudiante('12.345.678-9', 'Ana Estudiante'),
    ensureEstudiante('98.765.432-1', 'Bruno Practicante'),
  ]);

  const centro = await ensureCentro(
    'Liceo Bicentenario Arica',
    'Arica',
    'Arica y Parinacota',
  );

  const tutor = await ensureTutor('11.111.111-1', 'Profa. Teresa Tallerista');
  await ensureColaborador('22.222.222-2', 'Prof. Carlos Colaborador');

  const escala5 = [
    { descripcion: '1', puntaje: 1 },
    { descripcion: '2', puntaje: 2 },
    { descripcion: '3', puntaje: 3 },
    { descripcion: '4', puntaje: 4 },
    { descripcion: '5', puntaje: 5 },
  ];

  const preguntasCerradas = await Promise.all([
    ensurePregunta('secI.objetivos', 'CERRADA', escala5),
    ensurePregunta('secI.accionesEstablecimiento', 'CERRADA', escala5),
    ensurePregunta('secI.accionesTaller', 'CERRADA', escala5),
    ensurePregunta('secI.satisfaccionGeneral', 'CERRADA', escala5),
  ]);

  const preguntaAbierta = await ensurePregunta(
    'comentariosAdicionales',
    'ABIERTA',
  );

  const encuesta = await prisma.encuestaEstudiante.create({
    data: {
      nombre_estudiante: est1.rut,
      nombre_tallerista: tutor.nombre,
      nombre_colaborador: 'Docente Colaborador Demo',
      nombre_centro: centro.nombre,
      fecha: new Date('2024-10-15'),
      observacion: 'Observacion general de la practica.',
    },
  });

  const alternativas = await prisma.alternativa.findMany({
    where: { preguntaId: { in: preguntasCerradas.map((p) => p.id) } },
  });

  const pickAlt = (preguntaId: number, descripcion: string) =>
    alternativas.find(
      (a) => a.preguntaId === preguntaId && a.descripcion === descripcion,
    );

  await prisma.respuestaSeleccionada.createMany({
    data: [
      {
        encuestaEstudianteId: encuesta.id,
        preguntaId: preguntasCerradas[0].id,
        alternativaId: pickAlt(preguntasCerradas[0].id, '4')?.id,
      },
      {
        encuestaEstudianteId: encuesta.id,
        preguntaId: preguntasCerradas[1].id,
        alternativaId: pickAlt(preguntasCerradas[1].id, '5')?.id,
      },
      {
        encuestaEstudianteId: encuesta.id,
        preguntaId: preguntasCerradas[2].id,
        alternativaId: pickAlt(preguntasCerradas[2].id, '4')?.id,
      },
      {
        encuestaEstudianteId: encuesta.id,
        preguntaId: preguntasCerradas[3].id,
        alternativaId: pickAlt(preguntasCerradas[3].id, '5')?.id,
      },
      {
        encuestaEstudianteId: encuesta.id,
        preguntaId: preguntaAbierta.id,
        respuestaAbierta:
          'Comentarios de ejemplo sobre la experiencia de la practica.',
      },
    ],
  });

  console.log('Semilla creada: encuesta de estudiante con respuestas.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
