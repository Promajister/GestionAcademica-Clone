
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException, 
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProfesorDto } from './dto/create-profesor.dto';
import { UpdateProfesorDto } from './dto/update-profesor.dto';

@Injectable()
export class ProfesoresService {
  constructor(private readonly prisma: PrismaService) {}

// Usuarios activos que aún no están registrados como profesores
  async findUsuariosDisponibles() {
    return this.prisma.usuario.findMany({
      where: {
        activo: true,
        profesor: null,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        role: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  }

  // Registrar docente
  async create(dto: CreateProfesorDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: dto.id_usuario },
    });

    if (!usuario) {
    throw new NotFoundException('El usuario no existe');
    }

    if (!usuario.activo) {
    throw new BadRequestException(
        'No se puede registrar como docente a un usuario inactivo',
    );
    }

    const existente = await this.prisma.profesor.findUnique({
      where: { id_usuario: dto.id_usuario },
    });

    if (existente) {
      throw new ConflictException('El usuario ya está registrado como docente');
    }

    return this.prisma.profesor.create({
      data: {
        id_usuario: dto.id_usuario,
        contrato: dto.contrato,
      },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
            activo: true,
          },
        },
      },
    });
  }

  // Listar docentes
  async findAll() {
    return this.prisma.profesor.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
            activo: true,
          },
        },
        _count: {
          select: {
            cargaDocentes: true,
          },
        },
      },
      orderBy: {
        usuario: {
          nombre: 'asc',
        },
      },
    });
  }

  // Buscar docente por ID
  async findOne(id: number) {
    const profesor = await this.prisma.profesor.findUnique({
      where: { id_usuario: id },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
            activo: true,
          },
        },
        _count: {
          select: {
            cargaDocentes: true,
          },
        },
      },
    });

    if (!profesor) {
      throw new NotFoundException('Docente no encontrado');
    }

    return profesor;
  }

  // Actualizar contrato
  async update(id: number, dto: UpdateProfesorDto) {
    await this.findOne(id);

    if (dto.contrato === undefined) {
      throw new BadRequestException('No hay datos para actualizar');
    }

    // No permitir pasar a planta si ya declaró disponibilidad
    if (dto.contrato === 'PLANTA') {
      const total = await this.prisma.disponibilidad.count({
        where: { id_usuario: id },
      });

      if (total > 0) {
        throw new ConflictException(
          'El docente tiene disponibilidad registrada. Debe revisarla antes de cambiar su contrato.',
        );
      }
    }

    return this.prisma.profesor.update({
      where: { id_usuario: id },
      data: { contrato: dto.contrato },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
            activo: true,
          },
        },
      },
    });
  }

  
  // HOR-13 CA2:
  // Solo docentes activos contratados por horas
  // pueden declarar disponibilidad.
  async validarDisponibilidad(idUsuario: number): Promise<void> {
    const profesor = await this.prisma.profesor.findUnique({
      where: {
        id_usuario: idUsuario,
      },
      include: {
        usuario: {
          select: {
            activo: true,
          },
        },
      },
    });

    if (!profesor) {
      throw new NotFoundException(
        'El usuario no está registrado como docente',
      );
    }

    if (!profesor.usuario.activo) {
      throw new ForbiddenException(
        'El docente está inactivo y no puede declarar disponibilidad',
      );
    }

    if (profesor.contrato !== 'HORAS') {
      throw new ForbiddenException(
        'Solo los docentes contratados por horas pueden declarar disponibilidad',
      );
    }
  }

  // Eliminar docente
  async remove(id: number) {
    await this.findOne(id);

    const totalCargas = await this.prisma.cargaDocente.count({
      where: { id_usuario: id },
    });

    if (totalCargas > 0) {
      throw new ConflictException(
        'No se puede eliminar el docente porque tiene carga académica asignada',
      );
    }

    // Evitar borrar disponibilidades o bloques protegidos por cascada
    const [disponibilidades, bloquesProtegidos] = await Promise.all([
      this.prisma.disponibilidad.count({
        where: { id_usuario: id },
      }),
      this.prisma.bloqueProtegido.count({
        where: { id_usuario: id },
      }),
    ]);

    if (disponibilidades > 0 || bloquesProtegidos > 0) {
      throw new ConflictException(
        'El docente tiene registros horarios asociados y no puede eliminarse',
      );
    }

    await this.prisma.profesor.delete({
      where: { id_usuario: id },
    });

    return {
      mensaje: 'Docente eliminado correctamente',
    };
  }
}
