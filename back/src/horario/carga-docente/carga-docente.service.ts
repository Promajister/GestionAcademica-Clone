import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TipoOrigen } from '@prisma/client';

import { AsignarCargaDto } from './dto/create-carga.dto';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CargaDocenteService {
  constructor(private prisma: PrismaService) {}

  // Resuelve CA4 (solo activos) y CA3 (cálculo total de bloques/horas)
  async obtenerProfesoresParaAsignacion() {
    const profesores = await this.prisma.profesor.findMany({
      where: { usuario: { activo: true } },
      include: {
        cargaDocentes: true, // Incluimos sus cargas para calcular el total (HOR-43)
        usuario: true,
      },
      orderBy: { usuario: { nombre: 'asc' } },
    });

    return profesores.map((profesor) => ({
      id_usuario: profesor.id_usuario,
      nombre: profesor.usuario.nombre,
      contrato: profesor.contrato,
      // CA3: Sumamos las horas de todas las cargas que ya tiene asignadas
      total_horas_asignadas: profesor.cargaDocentes.reduce(
        (total, carga) => total + carga.cantidad_horas,
        0,
      ),
    }));
  }

  // Resuelve CA2 (Identificar pendientes). Solo asignaturas propias.
  async obtenerCursosConEstadoPendiente(
    semestreActual: number,
    yearActual: number,
  ) {
    const cursos = await this.prisma.curso.findMany({
      where: {
        semestre: semestreActual,
        year: yearActual,
        asignatura: { origen: TipoOrigen.INTERNA },
      },
      include: {
        asignatura: true,
        cargaDocentes: {
          include: { profesor: { include: { usuario: true } } },
        },
      },
      orderBy: [{ codigo_asignatura: 'asc' }, { grupo: 'asc' }],
    });

    return cursos.map((curso) => ({
      ...curso,
      // CA2: Si el arreglo de cargaDocentes está vacío, es true (pendiente)
      es_pendiente: curso.cargaDocentes.length === 0,
    }));
  }

  // Resuelve CA1 (Asignar uno o más profesores)
  async asignarCarga(dto: AsignarCargaDto) {
    const curso = await this.prisma.curso.findUnique({
      where: { id_curso: dto.id_curso },
      include: { asignatura: true },
    });
    if (!curso) {
      throw new NotFoundException('El curso no existe');
    }
    if (curso.asignatura.origen !== TipoOrigen.INTERNA) {
      throw new BadRequestException(
        'Solo se asigna carga docente a asignaturas propias',
      );
    }

    const ids = dto.profesores.map((p) => p.id_usuario);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Un profesor está repetido en la lista');
    }

    // CA4: solo profesores registrados y activos
    const activos = await this.prisma.profesor.findMany({
      where: { id_usuario: { in: ids }, usuario: { activo: true } },
      select: { id_usuario: true },
    });
    if (activos.length !== ids.length) {
      throw new BadRequestException(
        'Todos los profesores deben estar registrados como docentes y activos',
      );
    }

    // Reemplaza las asignaciones del curso en una sola transacción
    return this.prisma.$transaction([
      this.prisma.cargaDocente.deleteMany({
        where: { id_curso: dto.id_curso },
      }),
      this.prisma.cargaDocente.createMany({
        data: dto.profesores.map((prof) => ({
          id_curso: dto.id_curso,
          id_usuario: prof.id_usuario,
          cantidad_horas: prof.cantidad_horas,
        })),
      }),
    ]);
  }

  async eliminarCarga(id_curso: number, id_usuario: number) {
    const carga = await this.prisma.cargaDocente.findFirst({
      where: { id_curso, id_usuario },
    });
    if (!carga) {
      throw new NotFoundException('La asignación no existe');
    }

    return this.prisma.cargaDocente.delete({
      where: { id_carga: carga.id_carga },
    });
  }
}
