import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CalendarioService {
  constructor(private prisma: PrismaService) {}

  async obtenerOcupacionDepartamento(semestre: number, year: number) {
    const [salas, dias, bloques, periodoHorario, profesores] = await Promise.all([
      this.prisma.sala.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.dia.findMany({
        where: {
          nombre: { in: ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'] },
        },
        orderBy: { id_dia: 'asc' },
      }),
      this.prisma.bloqueHorario.findMany({
        orderBy: { id_bloque: 'asc' },
      }),
      this.prisma.periodoHorario.findUnique({
        where: {
          year_periodo: { year, periodo: semestre },
        },
      }),
      this.prisma.profesor.findMany({
        include: { usuario: true },
        orderBy: { usuario: { nombre: 'asc' } },
      }),
    ]);

    const horariosInternos = await this.prisma.horario.findMany({
      where: {
        carga: { curso: { semestre, year } },
        dia: { nombre: { in: ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'] } },
      },
      include: {
        carga: {
          include: {
            profesor: { include: { usuario: true } },
            curso: { include: { asignatura: true } },
          },
        },
      },
    });

    const horariosExternos = await this.prisma.horarioExterno.findMany({
      where: {
        id_sala: { not: null },
        curso: { semestre, year },
        dia: { nombre: { in: ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'] } },
      },
      include: {
        curso: { include: { asignatura: true } },
      },
    });

    const ocupaciones = [
      ...horariosInternos.map((h) => ({
        id_sala: h.id_sala,
        id_dia: h.id_dia,
        id_bloque: h.id_bloque,
        id_usuario: h.carga.id_usuario,
        tipo: 'INTERNA',
        codigo: h.carga.curso.asignatura.codigo,
        actividad: h.carga.curso.asignatura.nombre,
        grupo: h.carga.curso.grupo,
        docente: h.carga.profesor.usuario.nombre,
      })),
      ...horariosExternos.map((he) => ({
        id_sala: he.id_sala,
        id_dia: he.id_dia,
        id_bloque: he.id_bloque,
        id_usuario: -1, // <-- Cambiado de null a -1
        tipo: 'EXTERNA',
        codigo: he.curso.asignatura.codigo,
        actividad: `${he.curso.asignatura.nombre} (Externa)`,
        grupo: he.curso.grupo,
        docente: 'Docente Externo',
      })),
    ];

    const listaDocentes: { id_usuario: number; nombre: string; contrato: string }[] =
      profesores.map((p) => ({
        id_usuario: p.id_usuario,
        nombre: p.usuario.nombre,
        contrato: p.contrato,
      }));

    if (horariosExternos.length > 0) {
      listaDocentes.push({
        id_usuario: -1,
        nombre: 'Docente Externo',
        contrato: 'EXTERNA',
      });
    }

    return {
      estado_horario: periodoHorario?.estado ?? 'SIN_GENERAR',
      salas,
      dias,
      bloques,
      docentes: listaDocentes,
      ocupaciones,
    };
  }
}