import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AlcanceBloqueProtegido,
  EstadoHorario,
  Prisma,
  TipoCurso,
  TipoOrigen,
  TipoSala,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

import {
  CursoEntrada,
  DIAS_HABILES,
  NoAsignada,
  generarPropuesta,
  protegidoAfecta,
} from './generador';
import { Actividad, BloqueActividad, agruparActividades } from './actividades';
import {
  crucesConProtegidos,
  crucesDeDocente,
  crucesDeSala,
} from './validador';
import { MoverBloqueDto } from './dto/mover-bloque.dto';
import { choqueAlMover } from './reglas-mover';
import { TOTAL_BLOQUES, mismaJornada, rangoBloques } from '../common/grilla';

type Db = Prisma.TransactionClient | PrismaService;

// Primer bloque de una clase y su sala (null: sala de otro departamento)
interface Ubicacion {
  id_dia: number;
  bloque: number;
  id_sala: number | null;
}

const INCLUDE_CURSO = {
  asignatura: true,
  malla: { include: { plan: true } },
} satisfies Prisma.CursoInclude;

type CursoConMalla = Prisma.CursoGetPayload<{ include: typeof INCLUDE_CURSO }>;

// Periodo 1: niveles impares; periodo 2: niveles pares (semestre de la malla)
export const nivelEnPeriodo = (nivel: number, periodo: number) =>
  nivel % 2 === periodo % 2;

const nivelDe = (c: CursoConMalla) => c.malla?.semestre ?? c.semestre;
const cohorteDe = (c: CursoConMalla) =>
  c.malla ? `${c.malla.id_plan}-${c.malla.semestre}` : null;

@Injectable()
export class PropuestaService {
  constructor(private prisma: PrismaService) {}

  async estado(year: number, periodo: number, db: Db = this.prisma) {
    const fila = await db.periodoHorario.findUnique({
      where: { year_periodo: { year, periodo } },
    });
    return {
      year,
      periodo,
      estado: fila?.estado ?? EstadoHorario.BORRADOR,
      // En ISO: el interceptor global de fechas solo convierte objetos Date
      generado_en: fila?.generado_en?.toISOString() ?? null,
      cerrado_en: fila?.cerrado_en?.toISOString() ?? null,
      no_asignadas: (fila?.no_asignadas as unknown as NoAsignada[]) ?? [],
    };
  }

  async asegurarBorrador(year: number, periodo: number, db: Db = this.prisma) {
    const { estado } = await this.estado(year, periodo, db);
    if (estado === EstadoHorario.CERRADO) {
      throw new ConflictException(
        `El horario ${periodo}/${year} está cerrado; reábralo para modificarlo`,
      );
    }
  }

  // Cursos propios del periodo, con su malla para saber nivel, carrera y cohorte
  private async cursosPropios(year: number, periodo: number, db: Db) {
    const cursos = await db.curso.findMany({
      where: { year, asignatura: { origen: TipoOrigen.INTERNA } },
      include: {
        ...INCLUDE_CURSO,
        cargaDocentes: {
          include: {
            profesor: { include: { usuario: true, disponibilidad: true } },
          },
          orderBy: { id_carga: 'asc' },
        },
      },
      orderBy: { id_curso: 'asc' },
    });
    return cursos.filter((c) => nivelEnPeriodo(nivelDe(c), periodo));
  }

  // ---------- POST /horario/propuesta/generar ----------
  async generar(year: number, periodo: number) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.asegurarBorrador(year, periodo, tx);

        const cursos = await this.cursosPropios(year, periodo, tx);

        // Un curso de cátedra incluye taller y laboratorio si la asignatura no tiene cursos aparte para ellos
        const tiposPorAsignatura = new Map<string, Set<TipoCurso>>();
        for (const c of cursos) {
          const tipos =
            tiposPorAsignatura.get(c.codigo_asignatura) ?? new Set();
          tipos.add(c.tipo);
          tiposPorAsignatura.set(c.codigo_asignatura, tipos);
        }
        const bloquesDe = (c: (typeof cursos)[number]) => {
          const a = c.asignatura;
          if (c.tipo === TipoCurso.TALLER) return a.tallerSemanal;
          if (c.tipo === TipoCurso.LABORATORIO) return a.labSemanal;
          const tipos = tiposPorAsignatura.get(c.codigo_asignatura)!;
          return (
            a.catedraSemanal +
            (tipos.has(TipoCurso.TALLER) ? 0 : a.tallerSemanal) +
            (tipos.has(TipoCurso.LABORATORIO) ? 0 : a.labSemanal)
          );
        };

        const entrada: CursoEntrada[] = cursos.map((c) => ({
          id_curso: c.id_curso,
          codigo: c.codigo_asignatura,
          nombre: c.asignatura.nombre,
          grupo: c.grupo,
          inscritos: c.inscritos,
          bloques: bloquesDe(c),
          nivel: nivelDe(c),
          codigo_carrera: c.malla?.plan.codigo_carrera ?? null,
          cohorte: cohorteDe(c),
          docentes: c.cargaDocentes.map((cd) => ({
            id_carga: cd.id_carga,
            id_usuario: cd.id_usuario,
            nombre: cd.profesor.usuario.nombre,
            contrato: cd.profesor.contrato,
            disponibilidad: new Set(
              cd.profesor.disponibilidad.map(
                (d) => `${d.id_dia}-${d.id_bloque}`,
              ),
            ),
          })),
        }));

        const salas = await tx.sala.findMany({
          where: { activo: true, tipo: TipoSala.CLASES },
        });
        const protegidos = await tx.bloqueProtegido.findMany({
          where: { id_dia: { in: DIAS_HABILES } },
        });
        const externos = (
          await tx.horarioExterno.findMany({
            where: { curso: { year } },
            include: { curso: { include: INCLUDE_CURSO } },
          })
        ).filter((x) => nivelEnPeriodo(nivelDe(x.curso), periodo));

        const resultado = generarPropuesta({
          cursos: entrada,
          salas: salas.map((s) => ({
            id_sala: s.id_sala,
            nombre: s.nombre,
            capacidad: s.capacidad,
          })),
          protegidos,
          externos: externos.map((x) => ({
            id_dia: x.id_dia,
            id_bloque: x.id_bloque,
            id_sala: x.id_sala,
            cohorte: cohorteDe(x.curso),
            codigo: x.curso.codigo_asignatura,
            grupo: x.curso.grupo,
          })),
        });

        // La nueva propuesta reemplaza las clases propias del periodo
        await tx.horario.deleteMany({
          where: { carga: { id_curso: { in: cursos.map((c) => c.id_curso) } } },
        });

        const cargasPorCurso = new Map(
          cursos.map((c) => [
            c.id_curso,
            c.cargaDocentes.map((cd) => cd.id_carga),
          ]),
        );
        const filas: Prisma.HorarioCreateManyInput[] =
          resultado.sesiones.flatMap((s) =>
            s.bloques.flatMap((b) =>
              (cargasPorCurso.get(s.id_curso) ?? []).map((id_carga) => ({
                id_carga,
                id_sala: s.id_sala,
                id_dia: s.id_dia,
                id_bloque: b,
              })),
            ),
          );
        if (filas.length) await tx.horario.createMany({ data: filas });

        // Los cambios a mano de la propuesta anterior ya no se pueden deshacer
        await tx.movimientoHorario.deleteMany({ where: { year, periodo } });

        await tx.periodoHorario.upsert({
          where: { year_periodo: { year, periodo } },
          create: {
            year,
            periodo,
            estado: EstadoHorario.BORRADOR,
            generado_en: new Date(),
            no_asignadas:
              resultado.no_asignadas as unknown as Prisma.InputJsonValue,
          },
          update: {
            estado: EstadoHorario.BORRADOR,
            generado_en: new Date(),
            cerrado_en: null,
            no_asignadas:
              resultado.no_asignadas as unknown as Prisma.InputJsonValue,
          },
        });

        const bloquesAsignados = resultado.sesiones.reduce(
          (t, s) => t + s.bloques.length,
          0,
        );
        return {
          mensaje: 'Propuesta de horario generada',
          resumen: {
            cursos: cursos.length,
            cursos_completos: cursos.length - resultado.no_asignadas.length,
            bloques_asignados: bloquesAsignados,
            no_asignadas: resultado.no_asignadas.length,
          },
        };
      },
      { timeout: 30000 },
    );
  }

  // ---------- GET /horario/propuesta ----------
  async obtener(year: number, periodo: number) {
    const [estado, salas, bloques, movimientos, protegidos] = await Promise.all(
      [
        this.estado(year, periodo),
        this.prisma.sala.findMany({
          where: { activo: true },
          orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
          select: { id_sala: true, nombre: true, tipo: true, capacidad: true },
        }),
        this.bloquesDelPeriodo(year, periodo),
        this.prisma.movimientoHorario.count({ where: { year, periodo } }),
        this.protegidos(),
      ],
    );
    const actividades = agruparActividades(bloques);
    return {
      ...estado,
      salas,
      actividades,
      validacion: this.validarActividades(actividades, protegidos),
      movimientos,
    };
  }

  // ---------- PATCH /horario/propuesta/mover ----------
  // GEN-F02: mueve una clase a otro día, bloque o sala, guarda el movimiento y revalida todo.
  // Los cruces no impiden mover (se avisan); sí impiden cerrar el horario.
  async mover(dto: MoverBloqueDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.asegurarBorrador(dto.year, dto.periodo, tx);
      const largo = dto.bloque_fin - dto.bloque_inicio + 1;
      const desde: Ubicacion = {
        id_dia: dto.id_dia,
        bloque: dto.bloque_inicio,
        id_sala: dto.id_sala,
      };
      const hacia: Ubicacion = {
        id_dia: dto.hacia_dia,
        bloque: dto.hacia_bloque,
        id_sala: dto.hacia_sala ?? dto.id_sala,
      };
      if (largo < 1) {
        throw new BadRequestException(
          'bloque_fin no puede ser menor que bloque_inicio',
        );
      }
      if (
        desde.id_dia === hacia.id_dia &&
        desde.bloque === hacia.bloque &&
        desde.id_sala === hacia.id_sala
      ) {
        throw new BadRequestException('La clase ya está en ese lugar');
      }

      await this.trasladar(
        tx,
        { year: dto.year, periodo: dto.periodo },
        dto.origen,
        dto.id_curso,
        largo,
        desde,
        hacia,
      );
      await tx.movimientoHorario.create({
        data: {
          year: dto.year,
          periodo: dto.periodo,
          origen: dto.origen as TipoOrigen,
          id_curso: dto.id_curso,
          largo,
          desde_dia: desde.id_dia,
          desde_bloque: desde.bloque,
          desde_sala: desde.id_sala,
          hacia_dia: hacia.id_dia,
          hacia_bloque: hacia.bloque,
          hacia_sala: hacia.id_sala,
        },
      });

      return {
        mensaje: 'Clase movida',
        validacion: await this.validar(dto.year, dto.periodo, tx),
        movimientos: await tx.movimientoHorario.count({
          where: { year: dto.year, periodo: dto.periodo },
        }),
      };
    });
  }

  // ---------- POST /horario/propuesta/deshacer ----------
  // GEN-F02 CA3: deshace el último movimiento mientras el horario no esté cerrado
  async deshacer(year: number, periodo: number) {
    return this.prisma.$transaction(async (tx) => {
      await this.asegurarBorrador(year, periodo, tx);
      const ultimo = await tx.movimientoHorario.findFirst({
        where: { year, periodo },
        orderBy: { id: 'desc' },
      });
      if (!ultimo) {
        throw new ConflictException('No hay cambios para deshacer');
      }
      await this.trasladar(
        tx,
        { year, periodo },
        ultimo.origen,
        ultimo.id_curso,
        ultimo.largo,
        {
          id_dia: ultimo.hacia_dia,
          bloque: ultimo.hacia_bloque,
          id_sala: ultimo.hacia_sala,
        },
        {
          id_dia: ultimo.desde_dia,
          bloque: ultimo.desde_bloque,
          id_sala: ultimo.desde_sala,
        },
      );
      await tx.movimientoHorario.delete({ where: { id: ultimo.id } });

      return {
        mensaje: 'Cambio deshecho',
        validacion: await this.validar(year, periodo, tx),
        movimientos: await tx.movimientoHorario.count({
          where: { year, periodo },
        }),
      };
    });
  }

  // Cambia de lugar los bloques de una clase (todas las cargas del curso si es propia)
  private async trasladar(
    tx: Prisma.TransactionClient,
    p: { year: number; periodo: number },
    origen: 'INTERNA' | 'EXTERNA',
    id_curso: number,
    largo: number,
    desde: Ubicacion,
    hacia: Ubicacion,
  ) {
    const fin = hacia.bloque + largo - 1;
    if (fin > TOTAL_BLOQUES || !mismaJornada(hacia.bloque, fin)) {
      throw new BadRequestException(
        `Una clase de ${largo} bloque(s) no cabe desde el bloque ${hacia.bloque}: no puede cruzar la colación ni pasar del bloque ${TOTAL_BLOQUES}`,
      );
    }
    const bloquesDesde = rangoBloques(desde.bloque, desde.bloque + largo - 1);
    const bloquesHacia = rangoBloques(hacia.bloque, fin);
    await this.rechazarBloqueProtegido(
      tx,
      id_curso,
      hacia.id_dia,
      bloquesHacia,
      hacia.id_sala,
    );
    // Sala ocupada o clase del mismo semestre en esos bloques: no se mueve
    const choque = choqueAlMover(
      await this.bloquesDelPeriodo(p.year, p.periodo, tx),
      origen,
      id_curso,
      { id_dia: hacia.id_dia, id_sala: hacia.id_sala, bloques: bloquesHacia },
    );
    if (choque) throw new ConflictException(choque);

    if (hacia.id_sala !== desde.id_sala) {
      if (hacia.id_sala == null || desde.id_sala == null) {
        throw new BadRequestException(
          'Una clase en sala de otro departamento solo cambia de día o bloque',
        );
      }
      const sala = await tx.sala.findUnique({
        where: { id_sala: hacia.id_sala },
      });
      if (!sala || !sala.activo) {
        throw new BadRequestException(
          'La sala de destino no existe o está inactiva',
        );
      }
    }

    if (origen === 'INTERNA') {
      if (desde.id_sala == null || hacia.id_sala == null) {
        throw new BadRequestException(
          'Una clase propia siempre usa una sala del departamento',
        );
      }
      const filas = await tx.horario.findMany({
        where: {
          carga: { id_curso },
          id_dia: desde.id_dia,
          id_bloque: { in: bloquesDesde },
          id_sala: desde.id_sala,
        },
      });
      if (new Set(filas.map((f) => f.id_bloque)).size !== largo) {
        throw new NotFoundException(
          'La clase ya no está en ese lugar; recarga la propuesta',
        );
      }
      const otras = await tx.horario.findFirst({
        where: {
          carga: { id_curso },
          id_dia: hacia.id_dia,
          id_bloque: { in: bloquesHacia },
          NOT: { OR: filas.map((f) => ({ ...f })) },
        },
      });
      if (otras) {
        throw new ConflictException(
          'La asignatura ya tiene otra clase en esos bloques',
        );
      }
      await tx.horario.deleteMany({
        where: { OR: filas.map((f) => ({ ...f })) },
      });
      await tx.horario.createMany({
        data: filas.map((f) => ({
          id_carga: f.id_carga,
          id_dia: hacia.id_dia,
          id_bloque: hacia.bloque + (f.id_bloque - desde.bloque),
          id_sala: hacia.id_sala as number,
        })),
      });
      return;
    }

    const filas = await tx.horarioExterno.findMany({
      where: {
        id_curso,
        id_dia: desde.id_dia,
        id_bloque: { in: bloquesDesde },
        ...(desde.id_sala != null
          ? { id_sala: desde.id_sala }
          : { id_sala: null }),
      },
    });
    if (filas.length !== largo) {
      throw new NotFoundException(
        'La clase ya no está en ese lugar; recarga la propuesta',
      );
    }
    const otras = await tx.horarioExterno.findFirst({
      where: {
        id_curso,
        id_dia: hacia.id_dia,
        id_bloque: { in: bloquesHacia },
        id: { notIn: filas.map((f) => f.id) },
      },
    });
    if (otras) {
      throw new ConflictException(
        'La asignatura ya tiene otra clase en esos bloques',
      );
    }
    // Se borra y se vuelve a crear para no chocar con la clave única (curso, día, bloque)
    await tx.horarioExterno.deleteMany({
      where: { id: { in: filas.map((f) => f.id) } },
    });
    await tx.horarioExterno.createMany({
      data: filas.map((f) => ({
        id_curso,
        id_dia: hacia.id_dia,
        id_bloque: hacia.bloque + (f.id_bloque - desde.bloque),
        id_sala: hacia.id_sala,
        sala_externa: f.sala_externa,
      })),
    });
  }

  // No se asigna una clase en un bloque protegido que alcance a sus estudiantes o docentes
  private async rechazarBloqueProtegido(
    tx: Prisma.TransactionClient,
    id_curso: number,
    id_dia: number,
    bloques: number[],
    id_sala: number | null,
  ) {
    const curso = await tx.curso.findUnique({
      where: { id_curso },
      include: {
        malla: { include: { plan: true } },
        cargaDocentes: { include: { profesor: true } },
      },
    });
    if (!curso) throw new NotFoundException('El curso no existe');
    const clase = {
      codigo_carrera: curso.malla?.plan.codigo_carrera ?? null,
      nivel: curso.malla?.semestre ?? curso.semestre,
      id_sala,
      docentes: curso.cargaDocentes.map((cd) => ({
        id_usuario: cd.id_usuario,
        contrato: cd.profesor.contrato,
      })),
    };
    const protegidos = await tx.bloqueProtegido.findMany({
      where: { id_dia, id_bloque: { in: bloques } },
      include: { dia: true },
      orderBy: { id_bloque: 'asc' },
    });
    const p = protegidos.find((x) => protegidoAfecta(x, clase));
    if (p) {
      throw new BadRequestException(
        p.alcance === AlcanceBloqueProtegido.SALA
          ? `La sala está reservada: «${p.nombre}» (${p.dia.nombre} bloque ${p.id_bloque})`
          : `No se puede asignar la clase en un bloque protegido: «${p.nombre}» (${p.dia.nombre} bloque ${p.id_bloque})`,
      );
    }
  }

  // Bloques protegidos de lunes a viernes, uno por bloque
  private protegidos(db: Db = this.prisma) {
    return db.bloqueProtegido.findMany({
      where: { id_dia: { in: DIAS_HABILES } },
    });
  }

  // ---------- GET /horario/propuesta/validacion ----------
  // Revalida el horario completo del periodo
  async validar(year: number, periodo: number, db: Db = this.prisma) {
    const [bloques, protegidos] = await Promise.all([
      this.bloquesDelPeriodo(year, periodo, db),
      this.protegidos(db),
    ]);
    return this.validarActividades(agruparActividades(bloques), protegidos);
  }

  private validarActividades(
    actividades: Actividad[],
    protegidos: Awaited<ReturnType<PropuestaService['protegidos']>>,
  ) {
    const cruces_sala = crucesDeSala(actividades);
    const cruces_docente = crucesDeDocente(actividades);
    const cruces_protegido = crucesConProtegidos(actividades, protegidos);
    return {
      cruces_sala,
      cruces_docente,
      cruces_protegido,
      puede_cerrar:
        cruces_sala.length === 0 &&
        cruces_docente.length === 0 &&
        cruces_protegido.length === 0,
    };
  }

  // ---------- POST /horario/propuesta/cerrar ----------
  // GEN-F03 CA2 y GEN-F04 CA3: el horario no se cierra mientras existan cruces sin resolver
  async cerrar(year: number, periodo: number) {
    return this.prisma.$transaction(async (tx) => {
      const actual = await this.estado(year, periodo, tx);
      if (!actual.generado_en) {
        throw new ConflictException(
          `Aún no se genera la propuesta de horario ${periodo}/${year}`,
        );
      }
      if (actual.estado === EstadoHorario.CERRADO) {
        throw new ConflictException(
          `El horario ${periodo}/${year} ya está cerrado`,
        );
      }
      const v = await this.validar(year, periodo, tx);
      if (!v.puede_cerrar) {
        const pendientes = [
          v.cruces_sala.length && `${v.cruces_sala.length} cruce(s) de sala`,
          v.cruces_docente.length &&
            `${v.cruces_docente.length} cruce(s) de docente`,
          v.cruces_protegido.length &&
            `${v.cruces_protegido.length} clase(s) en bloque protegido`,
        ].filter(Boolean);
        throw new ConflictException({
          message: `No se puede cerrar el horario: hay ${pendientes.join(' y ')} sin resolver`,
          validacion: v,
        });
      }
      await tx.periodoHorario.update({
        where: { year_periodo: { year, periodo } },
        data: { estado: EstadoHorario.CERRADO, cerrado_en: new Date() },
      });
      // GEN-F02 CA3: al cerrar, los cambios quedan definitivos
      await tx.movimientoHorario.deleteMany({ where: { year, periodo } });
      return { mensaje: `Horario ${periodo}/${year} cerrado` };
    });
  }

  // ---------- POST /horario/propuesta/reabrir ----------
  async reabrir(year: number, periodo: number) {
    const actual = await this.estado(year, periodo);
    if (actual.estado !== EstadoHorario.CERRADO) {
      throw new ConflictException(
        `El horario ${periodo}/${year} no está cerrado`,
      );
    }
    await this.prisma.periodoHorario.update({
      where: { year_periodo: { year, periodo } },
      data: { estado: EstadoHorario.BORRADOR, cerrado_en: null },
    });
    return { mensaje: `Horario ${periodo}/${year} reabierto como borrador` };
  }

  // Todos los bloques ocupados del periodo: clases propias (Horario) y externas (HorarioExterno)
  async bloquesDelPeriodo(
    year: number,
    periodo: number,
    db: Db = this.prisma,
  ): Promise<BloqueActividad[]> {
    const internos = await db.horario.findMany({
      where: { carga: { curso: { year } } },
      include: {
        dia: true,
        sala: true,
        carga: {
          include: {
            curso: { include: INCLUDE_CURSO },
            profesor: { include: { usuario: true } },
          },
        },
      },
    });
    const externos = await db.horarioExterno.findMany({
      where: { curso: { year } },
      include: { dia: true, sala: true, curso: { include: INCLUDE_CURSO } },
    });

    // Varias cargas (docentes) de un curso comparten el mismo bloque: se juntan en uno
    const porBloque = new Map<string, BloqueActividad>();
    for (const h of internos) {
      const curso = h.carga.curso;
      if (!nivelEnPeriodo(nivelDe(curso), periodo)) continue;
      const k = `${curso.id_curso}-${h.id_dia}-${h.id_bloque}-${h.id_sala}`;
      const docente = {
        id_usuario: h.carga.id_usuario,
        nombre: h.carga.profesor.usuario.nombre,
        contrato: h.carga.profesor.contrato,
      };
      const previo = porBloque.get(k);
      if (previo) {
        previo.docentes.push(docente);
        continue;
      }
      porBloque.set(k, {
        origen: 'INTERNA',
        id_curso: curso.id_curso,
        codigo: curso.codigo_asignatura,
        nombre: curso.asignatura.nombre,
        grupo: curso.grupo,
        nivel: nivelDe(curso),
        id_plan: curso.malla?.id_plan ?? null,
        codigo_carrera: curso.malla?.plan.codigo_carrera ?? null,
        id_dia: h.id_dia,
        dia: h.dia.nombre,
        id_bloque: h.id_bloque,
        id_sala: h.id_sala,
        sala: h.sala.nombre,
        sala_externa: null,
        docentes: [docente],
      });
    }

    const bloquesExternos: BloqueActividad[] = externos
      .filter((x) => nivelEnPeriodo(nivelDe(x.curso), periodo))
      .map((x) => ({
        origen: 'EXTERNA',
        id_curso: x.id_curso,
        codigo: x.curso.codigo_asignatura,
        nombre: x.curso.asignatura.nombre,
        grupo: x.curso.grupo,
        nivel: nivelDe(x.curso),
        id_plan: x.curso.malla?.id_plan ?? null,
        codigo_carrera: x.curso.malla?.plan.codigo_carrera ?? null,
        id_dia: x.id_dia,
        dia: x.dia.nombre,
        id_bloque: x.id_bloque,
        id_sala: x.id_sala,
        sala: x.sala?.nombre ?? null,
        sala_externa: x.sala_externa,
        docentes: [],
      }));

    return [...porBloque.values(), ...bloquesExternos];
  }
}
