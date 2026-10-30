import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { TipoContrato, TipoDia } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfesoresService } from '../profesores/profesores.service';

import {
  DIAS_DISPONIBILIDAD,
  DiaDisponibilidad,
  GuardarDisponibilidadDto,
} from './dto/guardar-disponibilidad.dto';

// Tipos de contrato que declaran disponibilidad horaria (DIS-F02).
// Los docentes de planta no la registran: su carga se asigna directamente.
export const CONTRATOS_CON_DISPONIBILIDAD: TipoContrato[] = [
  TipoContrato.HORAS,
];

export interface BloqueDisponible {
  dia: DiaDisponibilidad;
  bloque: number;
}

export interface MiDisponibilidadResponse {
  profesor: {
    id_usuario: number;
    nombre: string;
    email: string;
    contrato: TipoContrato;
  };
  habilitado: boolean;
  contratos_habilitados: TipoContrato[];
  bloques: BloqueDisponible[];
}

@Injectable()
export class DisponibilidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profesoresService: ProfesoresService,
  ) {}

  // ---------- GET /horario/disponibilidad/mia ----------
  async obtenerPropia(idUsuario: number): Promise<MiDisponibilidadResponse> {
    const profesor = await this.buscarProfesor(idUsuario);
    const habilitado = CONTRATOS_CON_DISPONIBILIDAD.includes(profesor.contrato);

    const filas = habilitado
      ? await this.prisma.disponibilidad.findMany({
          where: { id_usuario: idUsuario },
          include: { dia: true },
          orderBy: [{ id_dia: 'asc' }, { id_bloque: 'asc' }],
        })
      : [];

    return {
      profesor: {
        id_usuario: profesor.id_usuario,
        nombre: profesor.usuario.nombre,
        email: profesor.usuario.email,
        contrato: profesor.contrato,
      },
      habilitado,
      contratos_habilitados: CONTRATOS_CON_DISPONIBILIDAD,
      bloques: filas
        .filter((f) =>
          DIAS_DISPONIBILIDAD.includes(f.dia.nombre as DiaDisponibilidad),
        )
        .map((f) => ({
          dia: f.dia.nombre as DiaDisponibilidad,
          bloque: f.id_bloque,
        })),
    };
  }

  // ---------- PUT /horario/disponibilidad/mia ----------
  // Reemplaza en una transacción toda la disponibilidad del docente autenticado.
  async guardarPropia(
    idUsuario: number,
    dto: GuardarDisponibilidadDto,
  ): Promise<MiDisponibilidadResponse> {
    await this.profesoresService.validarDisponibilidad(idUsuario);

    const profesor = await this.buscarProfesor(idUsuario);
    if (!CONTRATOS_CON_DISPONIBILIDAD.includes(profesor.contrato)) {
      throw new ForbiddenException(
        'Tu tipo de contrato no requiere registrar disponibilidad horaria',
      );
    }

    // Quitar duplicados (dia + bloque)
    const unicos = new Map<string, BloqueDisponible>();
    for (const b of dto.bloques ?? []) {
      unicos.set(`${b.dia}-${b.bloque}`, { dia: b.dia, bloque: b.bloque });
    }
    const bloques = [...unicos.values()];

    const idsDia = await this.mapaDias();

    await this.prisma.$transaction([
      this.prisma.disponibilidad.deleteMany({
        where: { id_usuario: idUsuario },
      }),
      this.prisma.disponibilidad.createMany({
        data: bloques.map((b) => ({
          id_usuario: idUsuario,
          id_dia: idsDia.get(b.dia)!,
          id_bloque: b.bloque,
        })),
      }),
    ]);

    return this.obtenerPropia(idUsuario);
  }

  // ---------- helpers ----------

  private async buscarProfesor(idUsuario: number) {
    const profesor = await this.prisma.profesor.findUnique({
      where: { id_usuario: idUsuario },
      include: { usuario: { select: { nombre: true, email: true } } },
    });
    if (!profesor) {
      throw new ForbiddenException(
        'El usuario autenticado no está registrado como docente',
      );
    }
    return profesor;
  }

  // Los id_dia vienen de la tabla `dias`; no se asume su numeración
  private async mapaDias(): Promise<Map<DiaDisponibilidad, number>> {
    const dias = await this.prisma.dia.findMany({
      where: { nombre: { in: DIAS_DISPONIBILIDAD as unknown as TipoDia[] } },
    });
    const mapa = new Map<DiaDisponibilidad, number>();
    for (const d of dias) mapa.set(d.nombre as DiaDisponibilidad, d.id_dia);
    if (mapa.size !== DIAS_DISPONIBILIDAD.length) {
      throw new InternalServerErrorException(
        'Faltan días hábiles en la tabla dias (ejecuta el seed)',
      );
    }
    return mapa;
  }
}
