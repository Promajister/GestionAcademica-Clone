import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AlcanceBloqueProtegido,
  Prisma,
  TipoContrato,
  TipoDia,
} from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { CreateBloqueProtegidoDto } from './dto/create-bloque-protegido.dto';
import { UpdateBloqueProtegidoDto } from './dto/update-bloque-protegido.dto';
import { QueryBloqueProtegidoDto } from './dto/query-bloque-protegido.dto';
import { QueryAplicablesDto } from './dto/query-aplicables.dto';
import { bloquePorNumero, mismaJornada, rangoBloques } from '../common/grilla';

type Tx = Prisma.TransactionClient;

type BloqueProtegidoConRelaciones = Prisma.BloqueProtegidoGetPayload<{
  include: {
    dia: true;
    bloque: true;
    carrera: true;
    profesor: {
      include: { usuario: true };
    };
  };
}>;

export interface BloqueProtegidoAgrupado {
  id_bloque_protegido: number;
  ids: number[];
  nombre: string;
  alcance: AlcanceBloqueProtegido;
  dia: string;
  id_dia: number;
  bloque_inicio: number;
  bloque_fin: number;
  bloques: number[];
  hora_inicio: string;
  hora_fin: string;
  codigo_carrera: string | null;
  semestre: number | null;
  contrato: TipoContrato | null;
  id_usuario: number | null;
  carrera: { codigo: string; nombre: string } | null;
  profesor: {
    id_usuario: number;
    contrato: TipoContrato;
    usuario: { id: number; nombre: string; email: string } | null;
  } | null;
}

@Injectable()
export class BloquesProtegidosService {
  constructor(private prisma: PrismaService) {}

  // Helper para agrupar filas consecutivas del mismo bloque protegido en un rango
  private agrupar(
    filas: BloqueProtegidoConRelaciones[],
  ): BloqueProtegidoAgrupado[] {
    const ordenadas = [...filas].sort((a, b) => {
      if (a.id_dia !== b.id_dia) return a.id_dia - b.id_dia;
      if (a.nombre !== b.nombre) return a.nombre.localeCompare(b.nombre);
      if (a.alcance !== b.alcance) return a.alcance.localeCompare(b.alcance);
      const cA = a.codigo_carrera ?? '';
      const cB = b.codigo_carrera ?? '';
      if (cA !== cB) return cA.localeCompare(cB);
      const sA = a.semestre ?? 0;
      const sB = b.semestre ?? 0;
      if (sA !== sB) return sA - sB;
      const uA = a.id_usuario ?? 0;
      const uB = b.id_usuario ?? 0;
      if (uA !== uB) return uA - uB;
      return a.id_bloque - b.id_bloque;
    });

    const grupos: BloqueProtegidoAgrupado[] = [];
    let actual: BloqueProtegidoConRelaciones[] = [];

    const mismoGrupo = (
      x: BloqueProtegidoConRelaciones,
      y: BloqueProtegidoConRelaciones,
    ) =>
      x.id_dia === y.id_dia &&
      x.nombre === y.nombre &&
      x.alcance === y.alcance &&
      x.codigo_carrera === y.codigo_carrera &&
      x.semestre === y.semestre &&
      x.contrato === y.contrato &&
      x.id_usuario === y.id_usuario;

    for (const f of ordenadas) {
      if (actual.length === 0) {
        actual.push(f);
      } else {
        const prev = actual[actual.length - 1];
        if (mismoGrupo(prev, f) && f.id_bloque === prev.id_bloque + 1) {
          actual.push(f);
        } else {
          grupos.push(this.construirAgrupado(actual));
          actual = [f];
        }
      }
    }

    if (actual.length > 0) {
      grupos.push(this.construirAgrupado(actual));
    }

    return grupos;
  }

  private construirAgrupado(
    items: BloqueProtegidoConRelaciones[],
  ): BloqueProtegidoAgrupado {
    const primero = items[0];
    const ultimo = items[items.length - 1];
    const bInicio = bloquePorNumero(primero.id_bloque);
    const bFin = bloquePorNumero(ultimo.id_bloque);

    return {
      id_bloque_protegido: primero.id_bloque_protegido,
      ids: items.map((i) => i.id_bloque_protegido),
      nombre: primero.nombre,
      alcance: primero.alcance,
      dia: primero.dia?.nombre ?? '',
      id_dia: primero.id_dia,
      bloque_inicio: primero.id_bloque,
      bloque_fin: ultimo.id_bloque,
      bloques: items.map((i) => i.id_bloque),
      hora_inicio: bInicio?.hora_inicio ?? '',
      hora_fin: bFin?.hora_fin ?? '',
      codigo_carrera: primero.codigo_carrera ?? null,
      semestre: primero.semestre ?? null,
      contrato: primero.contrato ?? null,
      id_usuario: primero.id_usuario ?? null,
      carrera: primero.carrera
        ? { codigo: primero.carrera.codigo, nombre: primero.carrera.nombre }
        : null,
      profesor: primero.profesor
        ? {
            id_usuario: primero.profesor.id_usuario,
            contrato: primero.profesor.contrato,
            usuario: primero.profesor.usuario
              ? {
                  id: primero.profesor.usuario.id,
                  nombre: primero.profesor.usuario.nombre,
                  email: primero.profesor.usuario.email,
                }
              : null,
          }
        : null,
    };
  }

  // ---------- GET /horario/bloques-protegidos ----------
  async findAll(
    q: QueryBloqueProtegidoDto,
  ): Promise<BloqueProtegidoAgrupado[]> {
    const where: Prisma.BloqueProtegidoWhereInput = {};

    if (q.alcance) where.alcance = q.alcance;
    if (q.dia) where.dia = { nombre: q.dia as TipoDia };
    if (q.codigo_carrera) where.codigo_carrera = q.codigo_carrera;
    if (q.semestre !== undefined) where.semestre = q.semestre;
    if (q.id_usuario !== undefined) where.id_usuario = q.id_usuario;

    const filas = await this.prisma.bloqueProtegido.findMany({
      where,
      include: {
        dia: true,
        bloque: true,
        carrera: true,
        profesor: {
          include: { usuario: true },
        },
      },
      orderBy: [{ id_dia: 'asc' }, { id_bloque: 'asc' }],
    });

    return this.agrupar(filas);
  }

  // ---------- GET /horario/bloques-protegidos/aplicables ----------
  async findAplicables(
    q: QueryAplicablesDto,
  ): Promise<BloqueProtegidoAgrupado[]> {
    let contratoProfesor: TipoContrato | null = null;
    if (q.id_usuario) {
      const prof = await this.prisma.profesor.findUnique({
        where: { id_usuario: q.id_usuario },
        select: { contrato: true },
      });
      if (prof) {
        contratoProfesor = prof.contrato;
      }
    }

    const condicionesAlcance: Prisma.BloqueProtegidoWhereInput[] = [];

    // Para grupo (carrera + semestre) o consulta institucional
    if (q.codigo_carrera || (!q.codigo_carrera && !q.id_usuario)) {
      condicionesAlcance.push({ alcance: 'UNIVERSIDAD' });
      condicionesAlcance.push({ alcance: 'FACULTAD' });
    }

    if (q.codigo_carrera) {
      condicionesAlcance.push({
        alcance: 'CARRERA',
        codigo_carrera: q.codigo_carrera,
      });
      if (q.semestre !== undefined && q.semestre !== null) {
        condicionesAlcance.push({
          alcance: { in: ['ESTUDIANTES', 'PRACTICA_PREPRACTICA'] },
          codigo_carrera: q.codigo_carrera,
          semestre: q.semestre,
        });
      }
    }

    // Para académico
    if (q.id_usuario) {
      condicionesAlcance.push({
        alcance: 'ACADEMICO_INDIVIDUAL',
        id_usuario: q.id_usuario,
      });
      if (contratoProfesor) {
        condicionesAlcance.push({
          alcance: 'ACADEMICOS',
          OR: [{ contrato: null }, { contrato: contratoProfesor }],
        });
      } else {
        condicionesAlcance.push({
          alcance: 'ACADEMICOS',
        });
      }
    }

    if (condicionesAlcance.length === 0) {
      return [];
    }

    const filas = await this.prisma.bloqueProtegido.findMany({
      where: { OR: condicionesAlcance },
      include: {
        dia: true,
        bloque: true,
        carrera: true,
        profesor: {
          include: { usuario: true },
        },
      },
      orderBy: [{ id_dia: 'asc' }, { id_bloque: 'asc' }],
    });

    return this.agrupar(filas);
  }

  // ---------- GET /horario/bloques-protegidos/profesores ----------
  async listProfesores() {
    return this.prisma.profesor.findMany({
      include: {
        usuario: {
          select: { id: true, nombre: true, email: true },
        },
      },
      orderBy: { usuario: { nombre: 'asc' } },
    });
  }

  // ---------- GET /horario/bloques-protegidos/:id ----------
  async findOne(id: number) {
    const bloque = await this.prisma.bloqueProtegido.findUnique({
      where: { id_bloque_protegido: id },
      include: {
        dia: true,
        bloque: true,
        carrera: true,
        profesor: {
          include: { usuario: true },
        },
      },
    });
    if (!bloque) {
      throw new NotFoundException('Bloque protegido no encontrado');
    }
    return bloque;
  }

  // ---------- POST /horario/bloques-protegidos ----------
  async create(dto: CreateBloqueProtegidoDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validar rango de bloques
      if (dto.bloque_fin < dto.bloque_inicio) {
        throw new BadRequestException(
          'bloque_fin no puede ser menor que bloque_inicio',
        );
      }
      if (
        dto.bloque_inicio < 1 ||
        dto.bloque_inicio > 12 ||
        dto.bloque_fin < 1 ||
        dto.bloque_fin > 12
      ) {
        throw new BadRequestException(
          'Los bloques deben estar en el rango de 1 a 12',
        );
      }
      if (!mismaJornada(dto.bloque_inicio, dto.bloque_fin)) {
        throw new BadRequestException(
          'Un rango no puede cruzar la colación entre los bloques 6 y 7',
        );
      }

      // 2. Normalizar días
      const diasNombres = (
        dto.dias && dto.dias.length > 0 ? dto.dias : dto.dia ? [dto.dia] : []
      ).map((d) => d.trim().toUpperCase());

      if (diasNombres.length === 0) {
        throw new BadRequestException('Debe indicar al menos un día');
      }

      const diasValidosPermitidos = [
        'LUNES',
        'MARTES',
        'MIERCOLES',
        'JUEVES',
        'VIERNES',
      ];
      for (const d of diasNombres) {
        if (!diasValidosPermitidos.includes(d)) {
          throw new BadRequestException(
            `Día no válido o no permitido: ${d}. Solo se permiten días de lunes a viernes`,
          );
        }
      }

      const diasEncontrados = await tx.dia.findMany({
        where: { nombre: { in: diasNombres as TipoDia[] } },
      });
      if (diasEncontrados.length !== diasNombres.length) {
        throw new BadRequestException(
          'Uno o más días especificados no existen en el sistema',
        );
      }

      // 3. Validar destinatarios según el alcance
      await this.validarDestinatario(tx, dto);

      // 4. Validar colisión / duplicado exacto
      const bloquesNums = rangoBloques(dto.bloque_inicio, dto.bloque_fin);
      for (const dia of diasEncontrados) {
        for (const bNum of bloquesNums) {
          const duplicado = await tx.bloqueProtegido.findFirst({
            where: {
              id_dia: dia.id_dia,
              id_bloque: bNum,
              nombre: dto.nombre,
              alcance: dto.alcance,
              codigo_carrera: dto.codigo_carrera ?? null,
              semestre: dto.semestre ?? null,
              contrato: dto.contrato ?? null,
              id_usuario: dto.id_usuario ?? null,
            },
          });
          if (duplicado) {
            throw new ConflictException(
              `Ya existe un bloque protegido idéntico para ${dia.nombre} bloque ${bNum}`,
            );
          }
        }
      }

      // 5. Expandir días × bloques e insertar
      const registrosAInsertar: Prisma.BloqueProtegidoCreateManyInput[] = [];
      for (const dia of diasEncontrados) {
        for (const bNum of bloquesNums) {
          registrosAInsertar.push({
            nombre: dto.nombre,
            alcance: dto.alcance,
            id_dia: dia.id_dia,
            id_bloque: bNum,
            codigo_carrera: dto.codigo_carrera ?? null,
            semestre: dto.semestre ?? null,
            contrato: dto.contrato ?? null,
            id_usuario: dto.id_usuario ?? null,
          });
        }
      }

      await tx.bloqueProtegido.createMany({
        data: registrosAInsertar,
      });

      return {
        mensaje: 'Bloques protegidos creados correctamente',
        total_creados: registrosAInsertar.length,
        nombre: dto.nombre,
        alcance: dto.alcance,
        dias: diasNombres,
        bloque_inicio: dto.bloque_inicio,
        bloque_fin: dto.bloque_fin,
      };
    });
  }

  // ---------- PATCH /horario/bloques-protegidos/:id ----------
  async update(id: number, dto: UpdateBloqueProtegidoDto) {
    const bloque = await this.prisma.bloqueProtegido.findUnique({
      where: { id_bloque_protegido: id },
    });
    if (!bloque) {
      throw new NotFoundException('Bloque protegido no encontrado');
    }

    const data: Prisma.BloqueProtegidoUncheckedUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.alcance !== undefined) data.alcance = dto.alcance;
    if (dto.id_dia !== undefined) data.id_dia = dto.id_dia;
    if (dto.id_bloque !== undefined) data.id_bloque = dto.id_bloque;
    if (dto.codigo_carrera !== undefined)
      data.codigo_carrera = dto.codigo_carrera;
    if (dto.semestre !== undefined) data.semestre = dto.semestre;
    if (dto.contrato !== undefined) data.contrato = dto.contrato;
    if (dto.id_usuario !== undefined) data.id_usuario = dto.id_usuario;

    return this.prisma.bloqueProtegido.update({
      where: { id_bloque_protegido: id },
      data,
      include: {
        dia: true,
        bloque: true,
        carrera: true,
        profesor: {
          include: { usuario: true },
        },
      },
    });
  }

  // ---------- DELETE /horario/bloques-protegidos/:id ----------
  async remove(id: number, grupo?: boolean) {
    const bloque = await this.prisma.bloqueProtegido.findUnique({
      where: { id_bloque_protegido: id },
    });
    if (!bloque) {
      throw new NotFoundException('Bloque protegido no encontrado');
    }

    if (grupo) {
      const res = await this.prisma.bloqueProtegido.deleteMany({
        where: {
          nombre: bloque.nombre,
          alcance: bloque.alcance,
          id_dia: bloque.id_dia,
          codigo_carrera: bloque.codigo_carrera,
          semestre: bloque.semestre,
          contrato: bloque.contrato,
          id_usuario: bloque.id_usuario,
        },
      });
      return {
        mensaje: 'Rango de bloques protegidos eliminado correctamente',
        eliminados: res.count,
      };
    }

    await this.prisma.bloqueProtegido.delete({
      where: { id_bloque_protegido: id },
    });
    return {
      mensaje: 'Bloque protegido eliminado correctamente',
      eliminados: 1,
    };
  }

  private async validarDestinatario(tx: Tx, dto: CreateBloqueProtegidoDto) {
    switch (dto.alcance) {
      case AlcanceBloqueProtegido.UNIVERSIDAD:
      case AlcanceBloqueProtegido.FACULTAD: {
        if (
          dto.codigo_carrera ||
          dto.semestre !== undefined ||
          dto.contrato ||
          dto.id_usuario !== undefined
        ) {
          throw new BadRequestException(
            `El alcance ${dto.alcance} no admite destinatario (carrera, semestre, contrato ni docente)`,
          );
        }
        break;
      }

      case AlcanceBloqueProtegido.CARRERA: {
        if (!dto.codigo_carrera) {
          throw new BadRequestException(
            'El alcance CARRERA requiere especificar codigo_carrera',
          );
        }
        if (
          dto.semestre !== undefined ||
          dto.contrato ||
          dto.id_usuario !== undefined
        ) {
          throw new BadRequestException(
            'El alcance CARRERA no admite semestre, contrato ni docente',
          );
        }
        const carrera = await tx.carrera.findUnique({
          where: { codigo: dto.codigo_carrera },
        });
        if (!carrera) {
          throw new BadRequestException(
            `La carrera con código ${dto.codigo_carrera} no existe`,
          );
        }
        break;
      }

      case AlcanceBloqueProtegido.ESTUDIANTES:
      case AlcanceBloqueProtegido.PRACTICA_PREPRACTICA: {
        if (!dto.codigo_carrera || dto.semestre === undefined) {
          throw new BadRequestException(
            `El alcance ${dto.alcance} requiere especificar codigo_carrera y semestre`,
          );
        }
        if (dto.contrato || dto.id_usuario !== undefined) {
          throw new BadRequestException(
            `El alcance ${dto.alcance} no admite contrato ni docente`,
          );
        }
        const carrera = await tx.carrera.findUnique({
          where: { codigo: dto.codigo_carrera },
        });
        if (!carrera) {
          throw new BadRequestException(
            `La carrera con código ${dto.codigo_carrera} no existe`,
          );
        }
        const malla = await tx.malla.findFirst({
          where: {
            semestre: dto.semestre,
            plan: { codigo_carrera: dto.codigo_carrera },
          },
        });
        if (!malla) {
          throw new BadRequestException(
            `El semestre ${dto.semestre} no existe en ninguna malla de la carrera ${dto.codigo_carrera}`,
          );
        }
        break;
      }

      case AlcanceBloqueProtegido.ACADEMICOS: {
        if (
          dto.codigo_carrera ||
          dto.semestre !== undefined ||
          dto.id_usuario !== undefined
        ) {
          throw new BadRequestException(
            'El alcance ACADEMICOS no admite carrera, semestre ni docente individual',
          );
        }
        break;
      }

      case AlcanceBloqueProtegido.ACADEMICO_INDIVIDUAL: {
        if (dto.id_usuario === undefined) {
          throw new BadRequestException(
            'El alcance ACADEMICO_INDIVIDUAL requiere especificar id_usuario',
          );
        }
        if (dto.codigo_carrera || dto.semestre !== undefined || dto.contrato) {
          throw new BadRequestException(
            'El alcance ACADEMICO_INDIVIDUAL no admite carrera, semestre ni contrato',
          );
        }
        const prof = await tx.profesor.findUnique({
          where: { id_usuario: dto.id_usuario },
        });
        if (!prof) {
          throw new BadRequestException(
            `El docente con id_usuario ${dto.id_usuario} no existe en Profesor`,
          );
        }
        break;
      }
    }
  }
}
