# Módulo Horario — Backend

Estado del módulo y contrato de la API adaptado al nuevo esquema de base de datos del equipo (modelos de Isaac Contreras + extensiones mínimas del Sprint 1).

## Puesta en marcha

```bash
git switch feat/horario-db-equipo
cd back
npm install
npx prisma migrate deploy   # aplica las migraciones del módulo
npx prisma generate
npx prisma db seed          # carga datos base e idempotentes de demo
npm run start:dev
```

El seed carga las 6 salas oficiales, los 7 días, los 12 bloques pedagógicos, los bloques protegidos base, las carreras 311 y 336 con sus planes (2016, 2025, 2005) y mallas completas, además de los cursos y horarios externos de demo para el Plan 2025 v1 (DU113 y DU042).

Pruebas manuales: `back/test/horario/*.http` (extensión REST Client de VS Code). Ejecutar primero el login de cada archivo.

## Autenticación

Todos los endpoints exigen sesión (`JwtCookieAuthGuard`, cookie `access_token`). **Todavía no tienen `@Roles`**: los perfiles del módulo se definen en ADM-F04.

## Grilla pedagógica

12 bloques de 45 min, lunes a viernes. Pausas de 10 min en la mañana y 5 min en la tarde; colación entre los bloques 6 y 7.
Definida en `common/grilla.ts` y expuesta en `GET /api/horario/grilla`.

| Bloque | Horario | | Bloque | Horario |
|---|---|---|---|---|
| 1 | 08:00–08:45 | | 7 | 14:45–15:30 |
| 2 | 08:45–09:30 | | 8 | 15:30–16:15 |
| 3 | 09:40–10:25 | | 9 | 16:20–17:05 |
| 4 | 10:25–11:10 | | 10 | 17:05–17:50 |
| 5 | 11:20–12:05 | | 11 | 17:55–18:40 |
| 6 | 12:05–12:50 | | 12 | 18:40–19:25 |

## Modelo de datos (Nueva BD del equipo)

```
Carrera 1─N Plan 1─N Malla N─1 Asignatura 1─N Curso
                                                ├─ 1─N HorarioExterno (externas bloqueadas)
                                                └─ 1─N CargaDocente 1─N Horario (clases)
Sala 1─N Horario / HorarioExterno / OcupacionPuntual
Dia, BloqueHorario 1─N Horario / HorarioExterno / BloqueProtegido / Disponibilidad
```

| Modelo | Notas |
|---|---|
| `Sala` (`salas`) | `id_sala` (PK), `nombre` único (`@unique`), `tipo` (`CLASES`/`REUNIONES`), `capacidad`, `activo` (default `true`). Sin campo `codigo`. |
| `Carrera` (`carreras`) | `codigo` string (PK, "311", "336"), `nombre`. |
| `Plan` (`planes`) | `id_plan` (PK), `year`, `version`, `codigo_carrera`. |
| `Asignatura` (`asignaturas`) | `codigo` string (PK), `nombre`, `catedraSemanal`, `tallerSemanal`, `labSemanal`, `origen` (`INTERNA`/`EXTERNA`). |
| `Malla` (`mallas`) | `id_malla` (PK), `id_plan`, `codigo_asignatura`, `semestre`. Permite que una misma asignatura pertenezca a múltiples planes. |
| `Curso` (`cursos`) | `id_curso` (PK), `tipo` (`CATEDRA`/`TALLER`/`LABORATORIO`), `grupo`, `inscritos` (cupo), `year`, `semestre`, `codigo_asignatura`, `id_malla`. |
| `HorarioExterno` (`horarios_externos`) | `id` (PK), `id_curso`, `id_dia`, `id_bloque`, `id_sala` (opcional), `sala_externa` (opcional). Bloques fijos y bloqueados de asignaturas externas. |
| `Horario` (`horarios`) | Clave compuesta (`id_carga`, `id_sala`, `id_dia`, `id_bloque`). Clases regulares con profesor asignado. |
| `OcupacionPuntual` (`ocupaciones_puntuales`) | Clave compuesta (`id_bloque`, `id_sala`, `fecha`). Reservas de salas puntuales por fecha. |

## API

Prefijo global: `/api`. Respuestas de error con `message` en español.

### Grilla
| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/horario/grilla` | `[{ numero, hora_inicio, hora_fin, jornada }]` |

### Salas (ADM-F01)
| Método | Ruta | Notas |
|---|---|---|
| GET | `/horario/salas?soloActivas=true` | Incluye `_count: { horarios, horariosExternos, ocupacionesPuntuales }` → sala "en uso" si la suma es > 0 |
| GET | `/horario/salas/:id` | Detalle de sala por `id_sala` |
| POST | `/horario/salas` | `{ nombre, tipo: CLASES\|REUNIONES, capacidad?, activo? }`. 409 si el nombre existe |
| PATCH | `/horario/salas/:id` | Campos opcionales |
| DELETE | `/horario/salas/:id` | En uso → `{ accion: 'DESACTIVADA', mensaje, sala }`. Sin uso → `{ accion: 'ELIMINADA', mensaje }` |

### Carreras y asignaturas (ADM-F02)
| Método | Ruta | Notas |
|---|---|---|
| GET | `/horario/carreras` | Carreras con `planes` y nombre formateado (`Plan {year} v{version}`) |
| GET | `/horario/asignaturas?origen=&id_carrera=&id_plan=&semestre=` | Asignaturas con mallas, cursos y bloques externos con sala |
| GET | `/horario/asignaturas/:codigo` | Detalle por código de asignatura |
| POST | `/horario/asignaturas` | `{ codigo, nombre, id_plan, semestre, bloques_semanales?, catedraSemanal?, tallerSemanal?, labSemanal?, cupo?, origen, bloques_externos? }` |
| PATCH | `/horario/asignaturas/:codigo` | Campos opcionales. `bloques_externos` reemplaza los bloques externos actuales |
| DELETE | `/horario/asignaturas/:codigo` | 409 si tiene cursos con carga docente |

### Bloques de asignaturas externas (ADM-F02-T3)
| Método | Ruta | Notas |
|---|---|---|
| POST | `/horario/asignaturas/:codigo/bloques-externos` | `{ bloques: [BloqueExterno] }` |
| DELETE | `/horario/asignaturas/:codigo/bloques-externos/:idBloque` | Elimina un bloque de HorarioExterno por su id |
| GET | `/horario/bloques?dia=&id_sala=&origen=` | Todos los bloques programados con `curso.asignatura`, `sala`, `origen` y `bloqueado` |

### Ocupaciones de sala
| Método | Ruta | Notas |
|---|---|---|
| GET | `/horario/ocupaciones?id_sala=&desde=&hasta=` | Ocupaciones puntuales por rango de fechas |
| POST | `/horario/ocupaciones` | `{ fecha, bloque_inicio, bloque_fin, id_sala }`. 409 si choca con clase u ocupación |
| DELETE | `/horario/ocupaciones/:idSala/:idBloque/:fecha` | Elimina la ocupación puntual |
