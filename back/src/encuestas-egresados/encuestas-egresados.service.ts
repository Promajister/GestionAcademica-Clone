import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type TipoEncuestaEgresados = 'EMPLEABILIDAD' | 'ACREDITACION';

@Injectable()
export class EncuestasEgresadosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<any[]> {
    try {
      return await this.prisma.encuestaEgresado.findMany({
        include: {
          respuestas: { include: { pregunta: true, alternativa: true } },
          semestre: true,
        },
        orderBy: { id: 'desc' },
      });
    } catch (err) {
      console.error('EncuestasEgresadosService.findAll error', err);
      throw new InternalServerErrorException('Error al obtener encuestas de egresados');
    }
  }

  async findOne(id: number): Promise<any> {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('ID invalido');
    }

    try {
      const encuesta = await this.prisma.encuestaEgresado.findUnique({
        where: { id },
        include: {
          respuestas: { include: { pregunta: true, alternativa: true } },
          semestre: true,
        },
      });

      if (!encuesta) {
        throw new NotFoundException('Encuesta no encontrada');
      }

      return encuesta;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error('EncuestasEgresadosService.findOne error', err);
      throw new InternalServerErrorException('Error al obtener encuesta de egresados');
    }
  }

  async create(payload: {
    tipo: 'EGRESADOS';
    anioEncuesta?: number;
    semestreEncuesta?: 1 | 2;
    data: {
      encuestaTipo: TipoEncuestaEgresados;
      generales?: Record<string, any>;
      insercion?: Record<string, any>;
      condiciones?: Record<string, any>;
      percepcion?: Record<string, any>;
      secciones?: Record<string, any>;
      abiertas?: Record<string, any>;
    };
  }): Promise<any> {
    try {
      if (!payload || !payload.tipo || !payload.data) {
        throw new BadRequestException('Payload invalido. Debe contener { tipo, data }');
      }

      const { data, anioEncuesta, semestreEncuesta } = payload;
      if (!data?.encuestaTipo) {
        throw new BadRequestException('Tipo de encuesta requerido');
      }

      let semestreRecord: { id: number } | null = null;
      if (anioEncuesta && semestreEncuesta) {
        semestreRecord = await this.prisma.encuestaSemestre.upsert({
          where: {
            anio_semestre_unique: {
              anio: anioEncuesta,
              semestre: semestreEncuesta,
            },
          },
          update: {},
          create: { anio: anioEncuesta, semestre: semestreEncuesta },
        });
      }

      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.encuestaEgresado.create({
          data: {
            tipo: data.encuestaTipo,
            fecha: new Date(),
            generales: data.generales ?? undefined,
            semestreId: semestreRecord ? semestreRecord.id : null,
          },
        });

        await this.saveRespuestasEgresados(tx, created.id, data);

        return { success: true, created };
      });
    } catch (err) {
      console.error('EncuestasEgresadosService.create error', err);
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('Error al crear la encuesta de egresados');
    }
  }

  private flattenRespuestas(prefix: string, value: any, out: Record<string, any>) {
    if (value === null || value === undefined) return;

    if (typeof value !== 'object' || Array.isArray(value)) {
      if (prefix) {
        out[prefix] = value;
      }
      return;
    }

    for (const [k, v] of Object.entries(value)) {
      const next = prefix ? `${prefix}.${k}` : k;
      this.flattenRespuestas(next, v, out);
    }
  }

  private async saveRespuestasEgresados(
    tx: any,
    encuestaId: number,
    data: {
      encuestaTipo: TipoEncuestaEgresados;
      insercion?: Record<string, any>;
      condiciones?: Record<string, any>;
      percepcion?: Record<string, any>;
      secciones?: Record<string, any>;
      abiertas?: Record<string, any>;
    },
  ) {
    const raw: Record<string, any> = {};

    if (data.insercion) {
      this.flattenRespuestas('insercion', data.insercion, raw);
    }
    if (data.condiciones) {
      this.flattenRespuestas('condiciones', data.condiciones, raw);
    }
    if (data.percepcion) {
      this.flattenRespuestas('percepcion', data.percepcion, raw);
    }
    if (data.secciones) {
      this.flattenRespuestas('secciones', data.secciones, raw);
    }
    if (data.abiertas) {
      this.flattenRespuestas('abiertas', data.abiertas, raw);
    }

    const openKeys = new Set([
      'percepcion.postgradoDetalle',
      'percepcion.capacitacionDetalle',
    ]);

    const respuestasToCreate: {
      encuestaEgresadoId: number;
      preguntaId: number;
      alternativaId?: number | null;
      respuestaAbierta?: string | null;
    }[] = [];

    for (const [clave, valor] of Object.entries(raw)) {
      if (valor === null || valor === undefined || valor === '') continue;

      const valStr = String(valor).trim();
      const esAbierta =
        openKeys.has(clave) ||
        (data.encuestaTipo === 'ACREDITACION' && clave.startsWith('abiertas.'));

      let pregunta = await tx.pregunta.findFirst({
        where: { descripcion: clave },
      });

      if (!pregunta) {
        pregunta = await tx.pregunta.create({
          data: {
            descripcion: clave,
            tipo: esAbierta ? 'ABIERTA' : 'CERRADA',
          },
        });
      }

      if (esAbierta) {
        respuestasToCreate.push({
          encuestaEgresadoId: encuestaId,
          preguntaId: pregunta.id,
          alternativaId: null,
          respuestaAbierta: valStr,
        });
      } else {
        let alternativa = await tx.alternativa.findFirst({
          where: {
            preguntaId: pregunta.id,
            descripcion: valStr,
          },
        });

        if (!alternativa) {
          const puntajeNumeric = Number(valStr);
          alternativa = await tx.alternativa.create({
            data: {
              descripcion: valStr,
              puntaje: Number.isNaN(puntajeNumeric) ? 0 : puntajeNumeric,
              preguntaId: pregunta.id,
            },
          });
        }

        respuestasToCreate.push({
          encuestaEgresadoId: encuestaId,
          preguntaId: pregunta.id,
          alternativaId: alternativa.id,
          respuestaAbierta: null,
        });
      }
    }

    if (!respuestasToCreate.length) return;

    await tx.respuestaSeleccionada.createMany({
      data: respuestasToCreate,
    });
  }

  async actualizarRespuestasAbiertas(
    encuestaId: number,
    body: { respuestas: { preguntaId: number; respuestaAbierta: string }[] },
  ) {
    const { respuestas } = body;
    if (!respuestas || !respuestas.length) {
      return { updated: 0 };
    }

    const encuesta = await this.prisma.encuestaEgresado.findUnique({
      where: { id: encuestaId },
      select: { id: true },
    });

    if (!encuesta) {
      throw new NotFoundException('Encuesta no encontrada');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const r of respuestas) {
        await tx.respuestaSeleccionada.updateMany({
          where: {
            encuestaEgresadoId: encuestaId,
            preguntaId: r.preguntaId,
          },
          data: {
            respuestaAbierta: r.respuestaAbierta ?? '',
          },
        });
      }
    });

    return { updated: respuestas.length };
  }

  async remove(id: number) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('ID invalido');
    }

    try {
      await this.prisma.encuestaEgresado.delete({ where: { id } });
      return { deleted: true };
    } catch (err) {
      console.error('EncuestasEgresadosService.remove error', err);
      throw new NotFoundException('Encuesta no encontrada');
    }
  }
}
