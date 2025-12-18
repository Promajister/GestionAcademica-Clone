// Servicio de negocio para encuestas (NestJS + Prisma + Excel)
import {Injectable,InternalServerErrorException,NotFoundException,BadRequestException} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import ExcelJS from 'exceljs';
import { Response } from 'express';

export type TipoEncuesta = 'ESTUDIANTIL' | 'COLABORADORES_JEFES';

@Injectable()
export class EncuestasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<any[]> {
    try {
      const encEst = await this.prisma.encuestaEstudiante.findMany({
        include: {
          respuestas: { include: { pregunta: true, alternativa: true } },
          semestre: true,
        },
        orderBy: { fecha: 'desc' },
      });

      const encCol = await this.prisma.encuestaColaborador.findMany({
        include: {
          respuestas: { include: { pregunta: true, alternativa: true } },
          semestre: true,
        },
        orderBy: { id: 'desc' },
      });

      const normalized = [
        ...encEst.map((e) => ({
          ...e,
          tipo: 'ESTUDIANTIL' as TipoEncuesta,
        })),
        ...encCol.map((e) => ({
          ...e,
          tipo: 'COLABORADORES_JEFES' as TipoEncuesta,
        })),
      ];

      return normalized;
    } catch (err) {
      console.error('EncuestasService.findAll error', err);
      throw new InternalServerErrorException('Error al obtener encuestas');
    }
  }

  // Trae una encuesta por ID, buscando primero en estudiantes y luego en colaboradores
  async findOne(id: number): Promise<any> {
    if (!id || Number.isNaN(id)) throw new BadRequestException('ID inválido');

    try {
      const est = await this.prisma.encuestaEstudiante.findUnique({
        where: { id },
        include: {
          respuestas: { include: { pregunta: true, alternativa: true } },
          semestre: true,
        },
      });
      if (est) return { ...est, tipo: 'ESTUDIANTIL' as TipoEncuesta };

      const col = await this.prisma.encuestaColaborador.findUnique({
        where: { id },
        include: {
          respuestas: { include: { pregunta: true, alternativa: true } },
          semestre: true,
        },
      });
      if (col) return { ...col, tipo: 'COLABORADORES_JEFES' as TipoEncuesta };

      throw new NotFoundException('Encuesta no encontrada');
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error('EncuestasService.findOne error', err);
      throw new InternalServerErrorException(
        'Error al obtener detalle de la encuesta',
      );
    }
  }

// -----------------------
//  CREATE
//  Payload: { tipo, data, semestre? }
// -----------------------
async create(payload: {
  tipo: TipoEncuesta;
  data: any;
  semestre?: { anio: number; semestre: number };
}): Promise<any> {
  try {
    if (!payload || !payload.tipo || !payload.data) {
      throw new BadRequestException(
        'Payload inválido. Debe contener { tipo, data }',
      );
    }

    const { tipo, data, semestre } = payload;

    // 1) Buscar / crear registro en tabla encuesta_semestre
    let semestreRecord: { id: number } | null = null;

    if (semestre && semestre.anio && semestre.semestre) {
      semestreRecord = await this.prisma.encuestaSemestre.upsert({
        where: {
          anio_semestre_unique: {
            anio: semestre.anio,
            semestre: semestre.semestre,
          },
        },
        update: {},
        create: {
          anio: semestre.anio,
          semestre: semestre.semestre,
        },
      });
    }

    // 2) Crear encuesta según el tipo
    if (tipo === 'ESTUDIANTIL') {
      // Crea encuesta de estudiante + respuestas en una transacción
      return this.prisma.$transaction(async (tx) => {
        const created = await tx.encuestaEstudiante.create({
          data: {
            nombre_estudiante: data.nombreEstudiante ?? null,
            nombre_tallerista: data.nombreTalleristaSupervisor ?? null,
            nombre_colaborador: data.nombreDocenteColaborador ?? null,
            tipo_practica: data.tipo_practica ?? null,
            nombre_docente_colaborador_opcional:
              data.nombre_docente_colaborador_opcional ?? null,
            nombre_centro: data.establecimiento ?? null,
            fecha: data.fechaEvaluacion
              ? new Date(data.fechaEvaluacion)
              : new Date(),
            // observación se llena con mejoraCoordinacion (mapeada desde el front)
            observacion: data.mejoraCoordinacion ?? null,
            semestreId: semestreRecord ? semestreRecord.id : null,
          },
        });

        await this.saveRespuestasGenericas(tx, {
          tipo,
          encuestaId: created.id,
          data,
        });

        return { success: true, created };
      });
    }

if (tipo === 'COLABORADORES_JEFES') {
  return this.prisma.$transaction(async (tx) => {
    const createData: any = {
      nombre_colaborador: data.nombreColaborador ?? null,
      nombre_colegio: data.centroEducativo ?? null,

      // ✅ agrega el tipo de práctica para que después se pueda filtrar en reportes
      tipo_practica: data.tipo_practica ?? null,

      // observación = comentarios adicionales sobre la práctica
      observacion: data.comentariosAdicionalesPractica ?? null,

      semestreId: semestreRecord ? semestreRecord.id : null,
    };

    const created = await tx.encuestaColaborador.create({
      data: createData,
    });

    await this.saveRespuestasGenericas(tx, {
      tipo,
      encuestaId: created.id,
      data,
    });

    return { success: true, created };
  });
}


    throw new BadRequestException('Tipo de encuesta no soportado');
  } catch (err) {
    console.error('EncuestasService.create error', err);
    if (err instanceof BadRequestException) throw err;
    throw new InternalServerErrorException('Error al crear la encuesta');
  }
}


  // -----------------------
  //  EXPORT TO EXCEL (encuestas estudiantes)
  //  Genera un Excel con cabeceras básicas y resumen de respuestas
  // -----------------------
  async exportEncuestasEstudiantesExcel(response: Response): Promise<void> {
    try {
      const encEst = await this.prisma.encuestaEstudiante.findMany({
        include: {
          respuestas: { include: { pregunta: true, alternativa: true } },
          semestre: true,
        },
        orderBy: { fecha: 'desc' },
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Encuestas Estudiantes');

      sheet.columns = [
        { header: 'ID', key: 'id', width: 8 },
        {
          header: 'Nombre Estudiante (rut)',
          key: 'nombre_estudiante',
          width: 24,
        },
        {
          header: 'Tallerista/Supervisor',
          key: 'nombre_tallerista',
          width: 30,
        },
        { header: 'Centro', key: 'nombre_centro', width: 30 },
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Observacion', key: 'observacion', width: 40 },
        { header: 'Semestre', key: 'semestre', width: 12 },
        { header: 'Resumen Respuestas', key: 'resumen', width: 80 },
      ];

      for (const e of encEst) {
        let resumen = '';
        if (e.respuestas && e.respuestas.length) {
          resumen = e.respuestas
            .map((r) => {
              const textoPregunta =
                r.pregunta?.descripcion ?? `pregunta_${r.preguntaId}`;
              const textoResp =
                r.alternativa?.descripcion ?? r.respuestaAbierta ?? '';
              return `${textoPregunta}: ${textoResp}`;
            })
            .join(' | ');
        }

        sheet.addRow({
          id: e.id,
          nombre_estudiante: e.nombre_estudiante ?? '',
          nombre_tallerista: e.nombre_tallerista ?? '',
          nombre_centro: e.nombre_centro ?? '',
          fecha: e.fecha ? e.fecha.toISOString() : '',
          observacion: e.observacion ?? '',
          semestre: e.semestre
            ? `${e.semestre.anio}-${e.semestre.semestre}`
            : '',
          resumen,
        });
      }

      response.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      response.setHeader(
        'Content-Disposition',
        'attachment; filename="encuestas_estudiantes.xlsx"',
      );

      await workbook.xlsx.write(response);
      response.end();
    } catch (err) {
      console.error(
        'EncuestasService.exportEncuestasEstudiantesExcel error',
        err,
      );
      throw new InternalServerErrorException('Error al generar el Excel');
    }
  }

  // -----------------------
  //  CATÁLOGOS (para selects en el front)
  // -----------------------

  // Estudiantes (rut + nombre)
  async getCatalogoEstudiantes(): Promise<{ rut: string; nombre: string }[]> {
    try {
      const estudiantes = await this.prisma.estudiante.findMany({
        select: { rut: true, nombre: true },
        orderBy: { nombre: 'asc' },
        take: 1000,
      });
      return estudiantes;
    } catch (err) {
      console.error('EncuestasService.getCatalogoEstudiantes error', err);
      throw new InternalServerErrorException('Error al obtener estudiantes');
    }
  }

  // Centros educativos (básico)
  async getCatalogoCentros(): Promise<
    { id: number; nombre: string; comuna?: string; region?: string }[]
  > {
    try {
      const centros = await this.prisma.centroEducativo.findMany({
        select: { id: true, nombre: true, comuna: true, region: true },
        orderBy: { nombre: 'asc' },
        take: 1000,
      });

      return centros.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        comuna: c.comuna ?? undefined,
        region: c.region ?? undefined,
      }));
    } catch (err) {
      console.error('EncuestasService.getCatalogoCentros error', err);
      throw new InternalServerErrorException('Error al obtener centros');
    }
  }

  // Colaboradores (profesores)
  async getCatalogoColaboradores(): Promise<{ id: number; nombre: string }[]> {
    try {
      const cols = await this.prisma.colaborador.findMany({
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
        take: 1000,
      });
      return cols;
    } catch (err) {
      console.error(
        'EncuestasService.getCatalogoColaboradores error',
        err,
      );
      throw new InternalServerErrorException(
        'Error al obtener colaboradores',
      );
    }
  }

  // Tutores / supervisores
  async getCatalogoTutores(): Promise<{ id: number; nombre: string }[]> {
    try {
      const tutors = await this.prisma.tutor.findMany({
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
        take: 1000,
      });
      return tutors;
    } catch (err) {
      console.error('EncuestasService.getCatalogoTutores error', err);
      throw new InternalServerErrorException('Error al obtener tutores');
    }
  }

  // -------------------------------------------------
  // Helpers privados para guardar RespuestaSeleccionada
  // -------------------------------------------------

  // Aplana un objeto anidado en claves tipo "secI.e1_planificacion"
  private flattenRespuestas(
    prefix: string,
    value: any,
    out: Record<string, any>,
  ) {
    if (value === null || value === undefined) return;

    if (typeof value !== 'object' || Array.isArray(value)) {
      const key = prefix;
      if (key) out[key] = value;
      return;
    }

    for (const [k, v] of Object.entries(value)) {
      const newPrefix = prefix ? `${prefix}.${k}` : k;
      this.flattenRespuestas(newPrefix, v, out);
    }
  }

  // Crea/encuentra preguntas y alternativas según el payload y guarda RespuestaSeleccionada
  private async saveRespuestasGenericas(
    tx: any,
    opts: {
      tipo: TipoEncuesta;
      encuestaId: number;
      data: any;
    },
  ) {
    const { tipo, encuestaId, data } = opts;

    const raw: Record<string, any> = {};

    if (tipo === 'ESTUDIANTIL') {
      // Secciones de la encuesta de estudiantes
      this.flattenRespuestas('secI', data.secI, raw);
      this.flattenRespuestas('secII_A', data.secII_A, raw);
      this.flattenRespuestas('secII_B', data.secII_B, raw);
      this.flattenRespuestas('secIII_A', data.secIII_A, raw);
      this.flattenRespuestas('secIII_B', data.secIII_B, raw);
      this.flattenRespuestas('secIII_C', data.secIII_C, raw);
      this.flattenRespuestas('secIV_T', data.secIV_T, raw);
      this.flattenRespuestas('secIV_S', data.secIV_S, raw);
      this.flattenRespuestas('secV', data.secV, raw);

      // Campo abierto general
      if (data.comentariosAdicionales) {
        raw['comentariosAdicionales'] = data.comentariosAdicionales;
      }
    } else {
      // COLABORADORES_JEFES
      this.flattenRespuestas('secI', data.secI, raw);
      this.flattenRespuestas('secII', data.secII, raw);
      this.flattenRespuestas('secIII', data.secIII, raw);

      if (data.sugerencias) {
        raw['sugerencias'] = data.sugerencias;
      }
      if (data.cumplePerfilEgreso) {
        raw['cumplePerfilEgreso'] = data.cumplePerfilEgreso;
      }
      if (data.comentariosAdicionalesPractica) {
        raw['comentariosAdicionalesPractica'] =
          data.comentariosAdicionalesPractica;
      }
      if (data.comentariosAdicionales) {
        raw['comentariosAdicionales'] = data.comentariosAdicionales;
      }
    }

    const respuestasToCreate: {
      encuestaEstudianteId?: number;
      encuestaColaboradorId?: number;
      preguntaId: number;
      alternativaId?: number | null;
      respuestaAbierta?: string | null;
    }[] = [];

    for (const [clave, valor] of Object.entries(raw)) {
      if (valor === null || valor === undefined || valor === '') continue;

      const keyLower = clave.toLowerCase();
      const valStr = String(valor).trim();
      const valLower = valStr.toLowerCase();

      // Heurística para decidir si la respuesta es abierta o cerrada
      const esAbierta =
        keyLower.includes('comentario') ||
        keyLower.includes('sugerencia') ||
        keyLower.includes('mejora') ||
        keyLower.includes('adicional') ||
        keyLower.includes('perfil') ||
        (typeof valor === 'string' &&
          !['1', '2', '3', '4', '5', 'na', 'si', 'no'].includes(valLower));

      // 1. Buscar o crear Pregunta por descripción (clave)
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
        // 2A. Respuesta abierta
        respuestasToCreate.push({
          encuestaEstudianteId: tipo === 'ESTUDIANTIL' ? encuestaId : undefined,
          encuestaColaboradorId:
            tipo === 'COLABORADORES_JEFES' ? encuestaId : undefined,
          preguntaId: pregunta.id,
          alternativaId: null,
          respuestaAbierta: valStr,
        });
      } else {
        // 2B. Respuesta cerrada (escala, sí/no, NA, etc.)
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
          encuestaEstudianteId: tipo === 'ESTUDIANTIL' ? encuestaId : undefined,
          encuestaColaboradorId:
            tipo === 'COLABORADORES_JEFES' ? encuestaId : undefined,
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

  // Actualiza solo respuestas abiertas de una encuesta (estudiante o colaborador)
  async actualizarRespuestasAbiertas(
    encuestaId: number,
    body: { respuestas: { preguntaId: number; respuestaAbierta: string }[] },
  ) {
    const { respuestas } = body;

    if (!respuestas || !respuestas.length) {
      return { updated: 0 };
    }

    // Detecta si el id corresponde a estudiante o colaborador
    const encuestaEst = await this.prisma.encuestaEstudiante.findUnique({
      where: { id: encuestaId },
      select: { id: true },
    });

    const encuestaCol = !encuestaEst
      ? await this.prisma.encuestaColaborador.findUnique({
          where: { id: encuestaId },
          select: { id: true },
        })
      : null;

    if (!encuestaEst && !encuestaCol) {
      throw new NotFoundException('Encuesta no encontrada');
    }

    const whereBase: any = encuestaEst
      ? { encuestaEstudianteId: encuestaId }
      : { encuestaColaboradorId: encuestaId };

    await this.prisma.$transaction(async (tx) => {
      for (const r of respuestas) {
        await tx.respuestaSeleccionada.updateMany({
          where: {
            ...whereBase,
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
}
