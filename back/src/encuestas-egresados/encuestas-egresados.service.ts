import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type TipoEncuestaEgresados = 'EMPLEABILIDAD' | 'ACREDITACION';

type IaProvider = {
  name: string;
  enabled: boolean;
  send: (prompt: string) => Promise<string | null>;
};

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

  async generarConclusion(payload: {
    tipo: TipoEncuestaEgresados;
    anioEgreso?: number | 'ALL';
    stats?: any;
  }) {
    if (!payload?.tipo) {
      throw new BadRequestException('Tipo de encuesta requerido');
    }

    const prompt = this.buildConclusionPrompt(payload);
    const conclusion = await this.generarConclusionIa(prompt);
    const texto = (conclusion ?? '').trim() || this.getResumenFallback();
    const anioKey = this.normalizeAnioEgreso(payload?.anioEgreso);

    await this.prisma.egresadosConclusion.upsert({
      where: {
        egresados_conclusion_unique: {
          tipo: payload.tipo,
          anioEgreso: anioKey,
        },
      },
      update: { texto },
      create: {
        tipo: payload.tipo,
        anioEgreso: anioKey,
        texto,
      },
    });

    return { texto };
  }

  async obtenerConclusion(tipo: TipoEncuestaEgresados, anioEgreso?: number | 'ALL') {
    if (!tipo) {
      throw new BadRequestException('Tipo de encuesta requerido');
    }

    const anioKey = this.normalizeAnioEgreso(anioEgreso);
    const row = await this.prisma.egresadosConclusion.findUnique({
      where: {
        egresados_conclusion_unique: {
          tipo,
          anioEgreso: anioKey,
        },
      },
    });

    return { texto: row?.texto ?? null };
  }

  private buildConclusionPrompt(payload: {
    tipo: TipoEncuestaEgresados;
    anioEgreso?: number | 'ALL';
    stats?: any;
  }): string {
    const safe = (value: any) => {
      if (value === null || value === undefined || value === '') return '-';
      return String(value);
    };
    const segments = (stat: any) => {
      const list = stat?.segments ?? [];
      if (!Array.isArray(list) || list.length === 0) return '-';
      return list
        .map((s: any) => `${safe(s?.label)}: ${safe(s?.pct)}% (${safe(s?.count)})`)
        .join('; ');
    };

    if (payload.tipo === 'EMPLEABILIDAD') {
      const stats = payload?.stats ?? {};
      const anio = payload?.anioEgreso ?? 'ALL';
      return [
        'Eres un analista de datos educativos. Redacta una conclusion relevante (10 a 15 oraciones) en espanol formal.',
        'No enumeres todos los graficos ni repitas datos crudos. Prioriza hallazgos, riesgos y oportunidades.',
        'Usa solo la informacion entregada. No inventes porcentajes ni hechos.',
        `Contexto: encuesta de empleabilidad. Anio egreso: ${safe(anio)}.`,
        `Total encuestas: ${safe(stats?.total)}`,
        `Con empleo vs sin empleo: ${segments(stats?.estadoLaboral)}`,
        `Tiempo primer empleo: ${segments(stats?.tiempoEmpleo)}`,
        `Empleo por genero: ${segments(stats?.empleoGenero)}`,
        `Sector laboral: ${segments(stats?.sector)}`,
        `Tipo de cargo: ${segments(stats?.cargo)}`,
        `Renta liquida: ${segments(stats?.renta)}`,
        `Tipo de institucion: ${segments(stats?.tipoInstitucion)}`,
        `Pertinencia formacion: ${segments(stats?.pertinencia)}`,
        `Postgrado: ${segments(stats?.postgrado)}`,
        `Capacitacion adicional: ${segments(stats?.capacitacion)}`,
        'Entrega solo el texto final, sin listas ni etiquetas.',
      ].join('\n');
    }

    const stats = payload?.stats ?? {};
    const preguntas = Array.isArray(stats?.preguntas) ? stats.preguntas : [];
    const preguntasTxt = preguntas.length
      ? preguntas.map((p: any) => {
        const label = safe(p?.label);
        const total = safe(p?.stat?.total);
        const segments = Array.isArray(p?.stat?.segments)
          ? p.stat.segments.map((s: any) => `${safe(s?.label)} ${safe(s?.pct)}% (${safe(s?.count)})`).join('; ')
          : '-';
        return `${label} | Total: ${total} | ${segments}`;
      }).join('\n')
      : '-';
    return [
      'Eres un analista de datos educativos. Redacta una conclusion clara en espanol formal.',
      'Debes mencionar TODOS los indicadores listados, usando porcentaje y conteo cuando exista.',
      'Es obligatorio cubrir cada indicador (sin saltar ninguno), con una frase breve por indicador.',
      'Cada indicador debe incluir una mini-conclusion basada en su distribucion (implica fortaleza, brecha u oportunidad).',
      'No asumas falta de respuestas; un 0% significa ausencia de esa categoria, no ausencia de datos.',
      'Usa solo la informacion entregada. No inventes porcentajes ni hechos.',
      'Contexto: encuesta de egresados y acreditacion.',
      `Total encuestas: ${safe(stats?.total)}`,
      `Promedio Likert: ${safe(stats?.promedioLikert)}%`,
      `Perfil de egreso: ${safe(stats?.pctPerfilEgreso)}% (${safe(stats?.countPerfilEgreso)})`,
      `Recursos e infraestructura: ${safe(stats?.pctRecursos)}% (${safe(stats?.countRecursos)})`,
      `Mejora continua: ${safe(stats?.pctMejora)}% (${safe(stats?.countMejora)})`,
      `Autoevaluacion: ${safe(stats?.pctAutoevaluacion)}% (${safe(stats?.countAutoevaluacion)})`,
      `Comentarios abiertos: ${safe(stats?.pctComentarios)}% (${safe(stats?.countComentarios)})`,
      'Detalle por pregunta (Likert):',
      preguntasTxt,
      'Entrega solo el texto final, sin listas ni etiquetas.',
    ].join('\n');
  }

  private async generarConclusionIa(prompt: string): Promise<string | null> {
    const providers = this.getProviders();
    if (providers.length === 0) {
      console.warn('[IA] No hay proveedores configurados');
      return null;
    }

    for (const provider of providers) {
      const text = await this.tryProvider(provider, prompt);
      if (text) return text;
    }

    return null;
  }

  private getProviders(): IaProvider[] {
    const providers: IaProvider[] = [
      {
        name: 'groq',
        enabled: Boolean(process.env.GROQ_API_KEY),
        send: (prompt: string) => this.callGroq(prompt),
      },
      {
        name: 'gemini',
        enabled: Boolean(process.env.GEMINI_API_KEY),
        send: (prompt: string) => this.callGemini(prompt),
      },
      {
        name: 'cerebras',
        enabled: Boolean(process.env.CEREBRAS_API_KEY),
        send: (prompt: string) => this.callCerebras(prompt),
      },
    ];

    return providers.filter((p) => p.enabled);
  }

  private async tryProvider(provider: IaProvider, prompt: string): Promise<string | null> {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const text = await provider.send(prompt);
      if (text) {
        console.info(`[IA] proveedor=${provider.name} ok`);
        return text;
      }
      if (attempt === 1) await this.sleep(350);
    }
    console.warn(`[IA] proveedor=${provider.name} sin respuesta`);
    return null;
  }

  private async callGemini(prompt: string): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
      },
    };

    const json = await this.postJson(url, payload, { 'Content-Type': 'application/json' }, 'gemini');
    if (!json) return null;
    const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('').trim();
    if (!text) {
      console.warn('[IA] Gemini respuesta vacia');
    }
    return text || null;
  }

  private async callGroq(prompt: string): Promise<string | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const payload = {
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 800,
    };

    const json = await this.postJson(
      url,
      payload,
      {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      'groq',
    );
    if (!json) return null;
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      console.warn('[IA] Groq respuesta vacia');
    }
    return text || null;
  }

  private async callCerebras(prompt: string): Promise<string | null> {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) return null;

    const url = 'https://api.cerebras.ai/v1/chat/completions';
    const payload = {
      model: 'llama3.1-8b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 800,
    };

    const json = await this.postJson(
      url,
      payload,
      {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      'cerebras',
    );
    if (!json) return null;
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      console.warn('[IA] Cerebras respuesta vacia');
    }
    return text || null;
  }

  private async postJson(
    url: string,
    payload: any,
    headers: Record<string, string>,
    provider: string,
  ): Promise<any | null> {
    const res = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
      provider,
    );

    if (!res?.ok) {
      const errText = await res?.text().catch(() => '');
      console.warn(`[IA] ${provider} respuesta no OK`, res?.status, errText);
      return null;
    }

    try {
      return await res.json();
    } catch {
      console.warn(`[IA] ${provider} respuesta invalida`);
      return null;
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: any,
    provider: string,
  ): Promise<any | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      return await (globalThis as any).fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch {
      console.warn(`[IA] Error al llamar ${provider}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getResumenFallback(): string {
    return 'Conclusion no disponible. El texto es generado por IA y puede estar limitado por cuota.';
  }

  private normalizeAnioEgreso(value?: number | 'ALL'): number {
    if (!value || value === 'ALL') return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
}
