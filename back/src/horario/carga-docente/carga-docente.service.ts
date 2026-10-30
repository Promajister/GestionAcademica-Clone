import { Injectable } from '@nestjs/common';

import { AsignarCargaDto } from './dto/create-carga.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class CargaDocenteService {
  constructor(private prisma: PrismaService) {}

  // Resuelve CA4 (solo activos) y CA3 (cálculo total de bloques/horas)
  async obtenerProfesoresParaAsignacion() {
    const profesores = await this.prisma.profesor.findMany({
      where: {
        // NOTA: Asumo que el estado "activo" viene del modelo Usuario. 
        // Si no es así, ajusta esta línea según cómo manejen los usuarios inactivos.
        usuario: { activo: true } 
      },
      include: {
        cargaDocentes: true, // Incluimos sus cargas para calcular el total (HOR-43)
        usuario: true
      },
    });

    return profesores.map((profesor) => ({
      id_usuario: profesor.id_usuario,
      nombre: profesor.usuario.nombre, // Asumiendo que Usuario tiene nombre
      contrato: profesor.contrato,
      // CA3: Sumamos las horas de todas las cargas que ya tiene asignadas
      total_horas_asignadas: profesor.cargaDocentes.reduce(
        (total, carga) => total + carga.cantidad_horas, 
        0
      ),
    }));
  }

  // Resuelve CA2 (Identificar pendientes)
  async obtenerCursosConEstadoPendiente(semestreActual: number, yearActual: number) {
    const cursos = await this.prisma.curso.findMany({
      where: { semestre: semestreActual, year: yearActual },
      include: {
        asignatura: true,
        cargaDocentes: {
          include: { profesor: { include: { usuario: true } } }
        }
      }
    });

    return cursos.map(curso => ({
      ...curso,
      // CA2: Si el arreglo de cargaDocentes está vacío, es true (pendiente)
      es_pendiente: curso.cargaDocentes.length === 0 
    }));
  }

  // Resuelve CA1 (Asignar uno o más profesores)
  async asignarCarga(dto: AsignarCargaDto) {
    // Primero, limpiamos las asignaciones anteriores de este curso para evitar duplicados
    await this.prisma.cargaDocente.deleteMany({
      where: { id_curso: dto.id_curso }
    });

    // Luego insertamos la nueva lista de profesores asignados a este curso
    const nuevasCargas = dto.profesores.map(prof => ({
      id_curso: dto.id_curso,
      id_usuario: prof.id_usuario,
      cantidad_horas: prof.cantidad_horas
    }));

    return this.prisma.cargaDocente.createMany({
      data: nuevasCargas
    });
  }
  async eliminarCarga(id_curso: number, id_usuario: number) {
    // Busca primero la asignación
    const carga = await this.prisma.cargaDocente.findFirst({
      where: { id_curso, id_usuario }
    });

    if (carga) {
      // Si existe, elimínala usando el id principal
      return this.prisma.cargaDocente.delete({
        where: { id_carga: carga.id_carga }
      });
    }
    return null;
  }
}