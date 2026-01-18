import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type SubtipoEncuestaJefatura =
  | 'AULA_ABIERTA_RECORRIDO_PEDAGOGICO'
  | 'ALTERNANCIAS_PREGRADO'
  | 'ALTERNANCIAS_RECEPTORES';

@Injectable()
export class EncuestasJefaturaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<any[]> {
    try {
      return await this.prisma.encuestaJefatura.findMany({
        include: {
          respuestas: { include: { pregunta: true, alternativa: true } },
          semestre: true,
        },
        orderBy: { id: 'desc' },
      });
    } catch (err) {
      console.error('EncuestasJefaturaService.findAll error', err);
      throw new InternalServerErrorException('Error al obtener encuestas de jefatura');
    }
  }

  async findOne(id: number): Promise<any> {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('ID invalido');
    }

    try {
      const encuesta = await this.prisma.encuestaJefatura.findUnique({
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
      console.error('EncuestasJefaturaService.findOne error', err);
      throw new InternalServerErrorException('Error al obtener encuesta de jefatura');
    }
  }

  async create(payload: {
    tipo: 'JEFATURA_CARRERA';
    anioEncuesta: number;
    semestreEncuesta: 1 | 2;
    data: {
      subtipo: SubtipoEncuestaJefatura;
      identificacion: Record<string, any>;
      secciones: Record<string, any>;
      abiertas: Record<string, any>;
    };
  }): Promise<any> {
    try {
      if (!payload || !payload.tipo || !payload.data) {
        throw new BadRequestException('Payload invalido. Debe contener { tipo, data }');
      }

      const { data, anioEncuesta, semestreEncuesta } = payload;
      if (!data?.subtipo) {
        throw new BadRequestException('Subtipo requerido');
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
        const identificacion = data.identificacion ?? {};
        const actividadIdRaw = identificacion?.actividadVinculacionId;
        const actividadVinculacionId =
          actividadIdRaw !== undefined && actividadIdRaw !== null
            ? Number(actividadIdRaw)
            : null;

        const created = await tx.encuestaJefatura.create({
          data: {
            subtipo: data.subtipo,
            fecha: new Date(),
            actividadVinculacionId: Number.isNaN(actividadVinculacionId)
              ? null
              : actividadVinculacionId,
            identificacion,
            semestreId: semestreRecord ? semestreRecord.id : null,
          },
        });

        await this.saveRespuestasJefatura(tx, created.id, data);

        return { success: true, created };
      });
    } catch (err) {
      console.error('EncuestasJefaturaService.create error', err);
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('Error al crear la encuesta de jefatura');
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

  private async saveRespuestasJefatura(
    tx: any,
    encuestaId: number,
    data: {
      secciones: Record<string, any>;
      abiertas: Record<string, any>;
    },
  ) {
    const raw: Record<string, any> = {};

    if (data.secciones) {
      for (const [secKey, secVal] of Object.entries(data.secciones)) {
        this.flattenRespuestas(secKey, secVal, raw);
      }
    }

    if (data.abiertas) {
      this.flattenRespuestas('abiertas', data.abiertas, raw);
    }

    const respuestasToCreate: {
      encuestaJefaturaId: number;
      preguntaId: number;
      alternativaId?: number | null;
      respuestaAbierta?: string | null;
    }[] = [];

    for (const [clave, valor] of Object.entries(raw)) {
      if (valor === null || valor === undefined || valor === '') continue;

      const valStr = String(valor).trim();
      const valLower = valStr.toLowerCase();

      const esAbierta =
        clave.toLowerCase().includes('abierta') ||
        clave.toLowerCase().includes('coment') ||
        clave.toLowerCase().includes('suger') ||
        (typeof valor === 'string' &&
          !['1', '2', '3', '4', '5', 'si', 'no'].includes(valLower));

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
          encuestaJefaturaId: encuestaId,
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
          encuestaJefaturaId: encuestaId,
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
}
