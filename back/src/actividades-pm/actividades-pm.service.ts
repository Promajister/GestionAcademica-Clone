import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

interface QueryFilters {
  anio?: string;
  tipo?: string;
  q?: string;
  fechaInicio?: string;
  fechaTermino?: string;
}

@Injectable()
export class ActividadesPmService {
  constructor(private prisma: PrismaService) {}

  async findUnidadByCodigo(codigo: string) {
    const normalized = codigo?.trim();
    if (!normalized) return null;
    return this.prisma.unidad.findUnique({
      where: { codigo: normalized },
      select: { id: true, codigo: true, nombre: true },
    });
  }

  async findResponsableByRut(rut: string) {
    const normalized = rut?.trim();
    if (!normalized) return null;
    return this.prisma.responsable.findUnique({
      where: { rut: normalized },
      select: { id: true, rut: true, nombre: true },
    });
  }

  async findEquipoTrabajoByRut(rut: string) {
    const normalized = rut?.trim();
    if (!normalized) return null;
    return this.prisma.equipoTrabajo.findUnique({
      where: { rut: normalized },
      select: { id: true, rut: true, nombre: true },
    });
  }

  async create(payload: any, files?: {
    asistencia?: Express.Multer.File[];
    documentos?: Express.Multer.File[];
    fotos?: Express.Multer.File[];
  }) {
    const data = this.buildData(payload, files);

    const created = await this.prisma.actividadVinculacion.create({
      data,
      include: this.includeAll(),
    });

    return created;
  }

  async findAll(filters: QueryFilters) {
    const where: any = {};

    if (filters?.tipo) {
      where.tipoActividad = filters.tipo;
    }

    const search = filters?.q?.trim();
    if (search) {
      where.nombre = { contains: search };
    }

    if (filters?.fechaInicio || filters?.fechaTermino) {
      const start = this.parseDate(filters.fechaInicio);
      const end = this.parseDate(filters.fechaTermino);
      if (start && end) {
        end.setHours(23, 59, 59, 999);
        where.fechaInicio = { gte: start, lte: end };
      } else if (start) {
        where.fechaInicio = { gte: start };
      } else if (end) {
        end.setHours(23, 59, 59, 999);
        where.fechaInicio = { lte: end };
      }
    } else if (filters?.anio) {
      const year = Number(filters.anio);
      if (!Number.isNaN(year)) {
        const start = new Date(year, 0, 1);
        const end = new Date(year + 1, 0, 1);
        where.fechaInicio = { gte: start, lt: end };
      }
    }

    return this.prisma.actividadVinculacion.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      include: this.includeAll(),
    });
  }

  async findOne(id: number) {
    const actividad = await this.prisma.actividadVinculacion.findUnique({
      where: { id },
      include: this.includeAll(),
    });

    if (!actividad) throw new NotFoundException('Actividad no encontrada');
    return actividad;
  }

  async update(
    id: number,
    payload: any,
    files?: {
      asistencia?: Express.Multer.File[];
      documentos?: Express.Multer.File[];
      fotos?: Express.Multer.File[];
    },
  ) {
    const exists = await this.prisma.actividadVinculacion.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('Actividad no encontrada');

    const data = this.buildData(payload, files);

    await this.prisma.unidadVinculacion.deleteMany({ where: { actividadVinculacionId: id } });
    await this.prisma.responsableVinculacion.deleteMany({ where: { actividadVinculacionId: id } });
    await this.prisma.equipoTrabajoVinculacion.deleteMany({ where: { actividadVinculacionId: id } });
    await this.prisma.financiamientoVinculacion.deleteMany({ where: { actividadVinculacionId: id } });
    await this.prisma.centroCostoVinculacion.deleteMany({ where: { actividadVinculacionId: id } });
    await this.prisma.matrizParticipantesVinculacion.deleteMany({ where: { actividadVinculacionId: id } });
    await this.prisma.institucionVinculacion.deleteMany({ where: { actividadVinculacionId: id } });
    await this.prisma.archivoEvidenciaVinculacion.deleteMany({ where: { actividadVinculacionId: id } });
    await this.prisma.estudianteActividadVinculacion.deleteMany({ where: { actividadVinculacionId: id } });

    const updated = await this.prisma.actividadVinculacion.update({
      where: { id },
      data,
      include: this.includeAll(),
    });

    return updated;
  }

  async regenerarResumen(id: number) {
    const actividad = await this.prisma.actividadVinculacion.findUnique({
      where: { id },
      include: this.includeAll(),
    });

    if (!actividad) throw new NotFoundException('Actividad no encontrada');

    const resumen = await this.generarResumenIa(actividad);
    return this.prisma.actividadVinculacion.update({
      where: { id },
      data: { resumenIa: resumen ?? this.getResumenFallback() },
      include: this.includeAll(),
    });
  }

  async remove(id: number) {
    try {
      return await this.prisma.actividadVinculacion.delete({
        where: { id },
      });
    } catch {
      throw new NotFoundException('Actividad no encontrada');
    }
  }

  private buildData(
    payload: any,
    files?: {
      asistencia?: Express.Multer.File[];
      documentos?: Express.Multer.File[];
      fotos?: Express.Multer.File[];
    },
  ) {
    const proyecto = payload?.proyecto ?? {};
    const evidencias = payload?.evidencias ?? {};
    const participantes = payload?.participantes ?? {};
    const difusiones = Array.isArray(payload?.difusiones) ? payload.difusiones : [];
    const impacto = payload?.impacto ?? {};
    const difusion = difusiones[0] ?? payload?.difusion ?? {};

    const tipoVinculacion =
      proyecto?.tipoVinculacion === 'Otro'
        ? proyecto?.tipoVinculacionOtro
        : proyecto?.tipoVinculacion;

    const archivos = this.buildArchivos(files, evidencias);
    const matrices = this.buildMatrices(participantes);

    const unidades = Array.isArray(payload?.unidades) ? payload.unidades : [];
    const responsables = Array.isArray(payload?.responsables) ? payload.responsables : [];
    const equipoTrabajo = Array.isArray(payload?.equipoTrabajo) ? payload.equipoTrabajo : [];
    const financiamientos = Array.isArray(payload?.financiamientos) ? payload.financiamientos : [];
    const centrosCosto = Array.isArray(payload?.centrosCosto) ? payload.centrosCosto : [];
    const instituciones = Array.isArray(payload?.instituciones) ? payload.instituciones : [];
    const estudiantes = this.buildEstudiantes(payload);

    return {
      tipoActividad: this.requiredText(proyecto?.tipoActividad),
      nombre: this.requiredText(proyecto?.nombre),
      objetivo: this.requiredText(proyecto?.objetivo),
      descripcion: this.requiredText(proyecto?.descripcion),

      tipoVinculacion: this.requiredText(tipoVinculacion),
      areaVinculacion: this.requiredText(proyecto?.areaVinculacion),
      areaImpacto: this.requiredText(proyecto?.areaImpacto),
      medidaImpacto: this.normalizeText(impacto?.medidaImpacto ?? payload?.medidaImpacto),
      indicadorImpacto: this.normalizeText(impacto?.indicadorImpacto ?? payload?.indicadorImpacto),
      sede: this.requiredText(proyecto?.sede),

      fechaInicio: this.requiredDate(proyecto?.fechaInicio),
      fechaTermino: this.requiredDate(proyecto?.fechaTermino),

      lugar: this.normalizeText(proyecto?.lugar),
      proyecto: this.normalizeText(proyecto?.proyectoAsociado),
      resultados: this.normalizeText(proyecto?.resultados),

      medioDifusion: this.normalizeText(difusion?.medio ?? difusion?.difusionEquipo),
      urlDifusion: this.normalizeText(difusion?.url ?? difusion?.difusionUrl),

      enlaceNoticia: this.normalizeText(evidencias?.enlaceNoticia),
      observaciones: this.normalizeText(evidencias?.observaciones),

      institucionVisitada: this.normalizeText(proyecto?.feriaInstitucionVisitada),

      temaCentral: this.normalizeText(proyecto?.jornadaTemaCentral),
      talleres: this.normalizeText(proyecto?.jornadaTalleres),
      responsableTaller: this.normalizeText(proyecto?.jornadaResponsableTaller),

      asignaturaRemedial: this.normalizeText(proyecto?.tallerAsignatura),
      competenciaAReforzar: this.normalizeText(proyecto?.tallerCompetencia),
      numeroEstudiantesBeneficiados: this.toInt(proyecto?.tallerNombreEstudiantesBeneficiados),

      nombreEvento: this.normalizeText(proyecto?.congresoNombreEvento),
      ponenciaPresentada: this.normalizeText(proyecto?.congresoPonenciaPresentada),
      relator: this.normalizeText(proyecto?.congresoRelator),

      colegioAsociado: this.normalizeText(proyecto?.alternanciaColegioAsociado),
      docenteColaborador: this.normalizeText(proyecto?.alternanciaDocenteColaborador),
      asignaturaAlternancia: this.normalizeText(proyecto?.alternanciaAsignatura),
      curso: this.normalizeText(proyecto?.alternanciaCurso),
      docenteAsignatura: this.normalizeText(proyecto?.alternanciaDocenteAsignatura),
      nombreActividadAlternancia: this.normalizeText(proyecto?.alternanciaNombreActividad),

      objetivoPedagogico: this.normalizeText(proyecto?.salidaObjetivoPedagogico),
      asignaturaVinculada: this.normalizeText(proyecto?.salidaAsignaturaVinculada),
      profesorResponsable: this.normalizeText(proyecto?.salidaProfesorResponsable),

      unidades: {
        create: unidades.map((u: any) => {
          const codigo = this.normalizeText(u?.cod ?? u?.codigo) ?? '';
          const nombre = this.normalizeText(u?.unidad ?? u?.nombre) ?? '';

          return {
            unidad: {
              connectOrCreate: {
                where: { codigo },
                create: { codigo, nombre },
              },
            },
          };
        }),
      },
      responsables: {
        create: responsables.map((r: any) => {
          const rut = this.normalizeText(r?.rut) ?? '';
          const nombre = this.normalizeText(r?.nombre) ?? '';
          const tipo = this.normalizeText(r?.tipo) ?? '';

          return {
            tipo,
            responsable: {
              connectOrCreate: {
                where: { rut },
                create: { rut, nombre, tipo },
              },
            },
          };
        }),
      },
      equiposTrabajo: {
        create: equipoTrabajo.map((e: any) => {
          const rut = this.normalizeText(e?.rut) ?? '';
          const nombre = this.normalizeText(e?.nombre) ?? '';
          const equipo = this.normalizeText(e?.tipo ?? e?.equipo) ?? '';

          return {
            equipo,
            equipoTrabajo: {
              connectOrCreate: {
                where: { rut },
                create: { rut, nombre },
              },
            },
          };
        }),
      },
      financiamientos: {
        create: financiamientos.map((f: any) => ({
          categoria: this.normalizeText(f?.categoria ?? f?.finCategoria) ?? '',
          tipo: this.normalizeText(f?.tipoFinanciamiento ?? f?.tipo) ?? '',
          monto: this.toInt(f?.monto ?? f?.finMonto),
        })),
      },
      centrosCosto: {
        create: centrosCosto.map((c: any) => ({
          nombre: this.normalizeText(c?.tipo ?? c?.nombre) ?? '',
        })),
      },
      instituciones: {
        create: instituciones.map((i: any) => ({
          tipo: this.normalizeText(i?.tipo) ?? '',
          nombre: this.normalizeText(i?.nombre) ?? '',
        })),
      },
      matricesParticipantes: {
        create: matrices,
      },
      archivosEvidencia: {
        create: archivos,
      },
      estudiantes: {
        create: estudiantes.map((s) => ({
          rut: this.normalizeText(s?.rut) ?? '',
          nombre: this.normalizeText(s?.nombre) ?? '',
        })),
      },
    };
  }

  private includeAll() {
    return {
      unidades: { include: { unidad: true } },
      responsables: { include: { responsable: true } },
      equiposTrabajo: { include: { equipoTrabajo: true } },
      financiamientos: true,
      centrosCosto: true,
      matricesParticipantes: true,
      instituciones: true,
      archivosEvidencia: true,
      estudiantes: true,
    };
  }

  private async generarResumenIa(actividad: any): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[IA] GEMINI_API_KEY no configurada');
      return null;
    }

    const prompt = this.buildResumenPrompt(actividad);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;

    try {
      const res = await (globalThis as any).fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 200,
          },
        }),
      });

      if (!res?.ok) {
        const errText = await res.text().catch(() => '');
        console.warn('[IA] Respuesta no OK', res?.status, errText);
        return null;
      }
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('').trim();
      if (!text) {
        console.warn('[IA] Respuesta vacia');
      }
      return text || null;
    } catch {
      console.warn('[IA] Error al llamar Gemini');
      return null;
    }
  }

  private buildResumenPrompt(actividad: any): string {
    const safe = (value: any) => {
      if (value === null || value === undefined || value === '') return '-';
      return String(value);
    };
    const list = (items: any[], mapFn: (item: any) => string) => {
      if (!Array.isArray(items) || items.length === 0) return '-';
      const mapped = items.map(mapFn).filter((x) => x);
      return mapped.length ? mapped.join(', ') : '-';
    };
    const tipoActividad = this.formatTipoActividad(actividad?.tipoActividad);
    const unidades = list(actividad?.unidades, (u: any) => u?.unidad?.nombre || u?.unidad?.codigo || u?.nombre || '');
    const responsables = list(actividad?.responsables, (r: any) => r?.responsable?.nombre || r?.nombre || '');
    const equipos = list(actividad?.equiposTrabajo, (e: any) => e?.equipoTrabajo?.nombre || e?.nombre || '');
    const fechas = `${safe(actividad?.fechaInicio)} a ${safe(actividad?.fechaTermino)}`;
    const participantes = this.resumenParticipantes(actividad?.matricesParticipantes ?? []);

    return [
      'Resume en 3-4 oraciones, en espanol claro y formal, la siguiente actividad de vinculacion.',
      'No inventes informacion y usa solo los datos entregados.',
      `Nombre: ${safe(actividad?.nombre)}`,
      `Tipo actividad: ${safe(tipoActividad)}`,
      `Objetivo: ${safe(actividad?.objetivo)}`,
      `Descripcion: ${safe(actividad?.descripcion)}`,
      `Area vinculacion: ${safe(actividad?.areaVinculacion)}`,
      `Sede: ${safe(actividad?.sede)}`,
      `Lugar: ${safe(actividad?.lugar)}`,
      `Fechas: ${fechas}`,
      `Resultados: ${safe(actividad?.resultados)}`,
      `Unidades: ${unidades}`,
      `Responsables: ${responsables}`,
      `Participantes (resumen): ${participantes}`,
      'Entrega solo el resumen, sin listas ni etiquetas.',
    ].join('\n');
  }

  private formatTipoActividad(value?: string | null): string {
    if (!value) return '-';
    return String(value).replace(/_/g, ' ').toLowerCase();
  }

  private resumenParticipantes(matrices: any[]): string {
    if (!Array.isArray(matrices) || matrices.length === 0) return '-';
    const sumRow = (row: any) => {
      const keys = [
        'directivosUta',
        'docentesUta',
        'estudiantesUta',
        'funcionariosGestionUta',
        'exalumnos',
        'otrosExternos',
      ];
      return keys.reduce((acc, k) => acc + (Number(row?.[k]) || 0), 0);
    };
    const asistentes = matrices.find((m: any) => m?.tipoParticipante === 'ASISTENTE');
    const expositores = matrices.find((m: any) => m?.tipoParticipante === 'EXPOSITOR');
    const totalAsistentes = asistentes ? sumRow(asistentes) : 0;
    const totalExpositores = expositores ? sumRow(expositores) : 0;
    return `asistentes ${totalAsistentes}, expositores ${totalExpositores}`;
  }

  private getResumenFallback(): string {
    return 'Resumen no disponible. El texto es generado por IA y puede estar limitado por cuota.';
  }

  private normalizeText(value: any): string | null {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    return str.length ? str : null;
  }

  private requiredText(value: any): string {
    const str = this.normalizeText(value);
    return str ?? '';
  }

  private parseDate(value: any): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  private requiredDate(value: any): Date {
    const date = this.parseDate(value);
    return date ?? new Date(0);
  }

  private toInt(value: any, fallback = 0): number {
    const n = Number(value);
    if (Number.isNaN(n)) return fallback;
    return Math.trunc(n);
  }

  private buildArchivos(
    files?: {
      asistencia?: Express.Multer.File[];
      documentos?: Express.Multer.File[];
      fotos?: Express.Multer.File[];
    },
    evidencias?: any,
  ) {
    const archivos: { tipo: string; url: string; nombre?: string | null }[] = [];

    for (const file of files?.asistencia ?? []) {
      archivos.push({
        tipo: 'LISTA_ASISTENCIA',
        url: `uploads/actividades-pm/${file.filename}`,
        nombre: file.originalname,
      });
    }

    for (const file of files?.documentos ?? []) {
      archivos.push({
        tipo: 'DOCUMENTO',
        url: `uploads/actividades-pm/${file.filename}`,
        nombre: file.originalname,
      });
    }

    for (const file of files?.fotos ?? []) {
      archivos.push({
        tipo: 'FOTOGRAFIA',
        url: `uploads/actividades-pm/${file.filename}`,
        nombre: file.originalname,
      });
    }

    const listaAsistenciaRef = this.normalizeText(evidencias?.listaAsistenciaRef);
    if (listaAsistenciaRef) {
      archivos.push({
        tipo: 'LISTA_ASISTENCIA',
        url: listaAsistenciaRef,
      });
    }

    const documentosRef = this.normalizeText(evidencias?.documentosRef);
    if (documentosRef) {
      archivos.push({
        tipo: 'DOCUMENTO',
        url: documentosRef,
      });
    }

    const fotosRef = this.normalizeText(evidencias?.fotosRef);
    if (fotosRef) {
      archivos.push({
        tipo: 'FOTOGRAFIA',
        url: fotosRef,
      });
    }

    return archivos;
  }

  private buildMatrices(participantes: Record<string, any>) {
    const mapKey = (raw: string) => {
      const clean = raw.toUpperCase().replace(/[^A-Z]/g, '');
      if (clean.includes('DIRECTIVOS') && clean.includes('UTA')) return 'directivosUta';
      if (clean.includes('DOCENTES') && clean.includes('UTA')) return 'docentesUta';
      if (clean.includes('ESTUDIANTES') && clean.includes('UTA')) return 'estudiantesUta';
      if (clean.includes('FUNCIONARIOS') && clean.includes('GESTION') && clean.includes('UTA')) return 'funcionariosGestionUta';
      if (clean.includes('EXALUMNOS')) return 'exalumnos';
      if (clean.includes('OTROS') && clean.includes('EXTERNOS')) return 'otrosExternos';
      return null;
    };

    const build = (tipo: 'ASISTENTE' | 'EXPOSITOR') => {
      const row: any = {
        tipoParticipante: tipo,
        directivosUta: 0,
        docentesUta: 0,
        estudiantesUta: 0,
        funcionariosGestionUta: 0,
        exalumnos: 0,
        otrosExternos: 0,
      };

      for (const [key, value] of Object.entries(participantes ?? {})) {
        if (!key.startsWith(`${tipo}__`)) continue;
        const raw = key.replace(`${tipo}__`, '');
        const field = mapKey(raw);
        if (!field) continue;
        row[field] = this.toInt(value, 0);
      }

      return row;
    };

    return [build('ASISTENTE'), build('EXPOSITOR')];
  }

  private buildEstudiantes(payload: any) {
    const estudiantes: any[] = [];
    const lista = Array.isArray(payload?.estudiantes) ? payload.estudiantes : [];
    const feria = Array.isArray(payload?.estudiantesFeria) ? payload.estudiantesFeria : [];
    const salida = Array.isArray(payload?.estudiantesSalida) ? payload.estudiantesSalida : [];

    for (const item of [...lista, ...feria, ...salida]) {
      const rut = this.normalizeText(item?.rut);
      const nombre = this.normalizeText(item?.nombre);
      if (!rut && !nombre) continue;
      estudiantes.push({ rut, nombre });
    }

    return estudiantes;
  }
}
