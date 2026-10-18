# Módulo Horario — Backend

Estado del módulo y contrato de la API para quienes construyen sobre él (front, carga docente, perfiles, generador).
Historias implementadas: **ADM-F01** (salas) y **ADM-F02** (asignaturas y bloques externos), más grilla y ocupaciones de sala.

## Puesta en marcha

```bash
git switch Master-vinculacion && git pull
cd back
npm install
npx prisma migrate deploy   # aplica las migraciones del módulo
npx prisma generate
npx prisma db seed          # usar este comando: `npm run seed` no carga el .env
npm run start:dev
```

El seed carga las 6 salas del departamento y las carreras 311 (planes 2016 y 2025) y 336 (plan 2005).

Pruebas manuales: `back/test/horario/*.http` (extensión REST Client de VS Code). Ejecutar primero el login de cada archivo.

## Autenticación

Todos los endpoints exigen sesión (`JwtCookieAuthGuard`, cookie `access_token`). **Todavía no tienen `@Roles`**: los perfiles del módulo se definen en ADM-F04.
Para restringirlos basta agregar en cada controlador de `src/horario/*/`:

```ts
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('jefatura', 'secretaria')
```

> `RolesGuard` compara roles con `includes()` (coincidencia parcial del nombre). Elegir claves de rol que no se contengan entre sí.

## Grilla pedagógica

12 bloques de 45 min, lunes a viernes. Las clases suelen ocupar 2 bloques. Pausas de 10 min en la mañana y 5 min en la tarde; colación entre los bloques 6 y 7.
Definida en `common/grilla.ts` y expuesta en `GET /api/horario/grilla`.

| Bloque | Horario | | Bloque | Horario |
|---|---|---|---|---|
| 1 | 08:00–08:45 | | 7 | 14:45–15:30 |
| 2 | 08:45–09:30 | | 8 | 15:30–16:15 |
| 3 | 09:40–10:25 | | 9 | 16:20–17:05 |
| 4 | 10:25–11:10 | | 10 | 17:05–17:50 |
| 5 | 11:20–12:05 | | 11 | 17:55–18:40 |
| 6 | 12:05–12:50 | | 12 | 18:40–19:25 |

`Bloque_horario` guarda **una fila por bloque de 45 min** (`dia` + `bloque_numero`); `hora_inicio`/`hora_fin` se derivan de la grilla. Los rangos que se envían a la API (`bloque_inicio`–`bloque_fin`) no pueden cruzar la colación.

## Modelo de datos

```
Carrera 1─N Plan 1─N Asignatura 1─N Curso 1─N Bloque_horario N─1 Sala
                                                  └─ N─1 Horario (opcional)
Sala 1─N Ocupacion_sala N─1 Usuario (quien la registró)
```

| Modelo | Notas |
|---|---|
| `Sala` | `codigo` y `nombre` únicos (sin distinguir mayúsculas ni tildes). `activo` para desactivación lógica. |
| `Carrera` / `Plan` | `Carrera.codigo` único ("311", "336"). `Plan.vigente`; la 311 tiene dos planes vigentes. |
| `Asignatura` | Única por `(id_plan, codigo, semestre)`: un código se repite entre planes (HG417) y semestres (YY023). `origen`: `PROPIA` / `EXTERNA`. |
| `Curso` | Al crear una asignatura se crea **un Curso por defecto** (`REGULAR` o `EXTERNO`). `Carga_Docente` y `Bloque_horario` se vinculan a `Curso`. |
| `Bloque_horario` | `bloqueado = true` en asignaturas externas. `id_sala` **o** `sala_externa` (sala de otro departamento). `id_horario` opcional hasta el Sprint 2. |
| `Ocupacion_sala` | Uso de una sala fuera del horario de 311/336. `PUNTUAL` (una `fecha`) o `SEMESTRAL` (un `dia` fijo). |
| `Horario` | Mínimo (`anio`, `semestre`, `estado`) para el generador del Sprint 2. |

Convenciones: modelos del módulo en `snake_case` con `@@map`, según el ERD del equipo. `Usuario` es el modelo existente del sistema: su PK es **`id`** (no `id_usuario`) y sus roles son claves de la tabla `rol`.

## API

Prefijo global: `/api`. Errores en español en `message`.

### Grilla
| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/horario/grilla` | `[{ numero, hora_inicio, hora_fin, jornada }]` |

### Salas (ADM-F01)
| Método | Ruta | Notas |
|---|---|---|
| GET | `/horario/salas?soloActivas=true` | Incluye `_count: { bloques_horarios, ocupaciones }` → sala "en uso" si alguno es > 0 |
| GET | `/horario/salas/:id` | |
| POST | `/horario/salas` | `{ codigo, nombre, tipo: CLASES\|REUNION, capacidad?, activo? }`. **409** si nombre o código existe |
| PATCH | `/horario/salas/:id` | Mismos campos, opcionales |
| DELETE | `/horario/salas/:id` | En uso → `{ accion: 'DESACTIVADA', mensaje, sala }`. Sin uso → `{ accion: 'ELIMINADA', mensaje }` |

### Carreras y asignaturas (ADM-F02)
| Método | Ruta | Notas |
|---|---|---|
| GET | `/horario/carreras` | Carreras con `planes` vigentes (para los selectores) |
| GET | `/horario/asignaturas?origen=&id_carrera=&id_plan=&semestre=` | Incluye `plan.carrera` y `cursos[].bloques_horarios[].sala`; cada bloque trae `origen` |
| GET | `/horario/asignaturas/:id` | |
| POST | `/horario/asignaturas` | `{ codigo, nombre, id_plan, semestre, bloques_semanales, cupo, origen, bloques_externos? }` |
| PATCH | `/horario/asignaturas/:id` | Campos opcionales. `bloques_externos` **reemplaza** todos los bloques (`[]` los borra). No se puede cambiar `origen` si ya tiene bloques |
| DELETE | `/horario/asignaturas/:id` | Borra cursos y bloques en cascada |

### Bloques de asignaturas externas (ADM-F02-T3)
| Método | Ruta | Notas |
|---|---|---|
| POST | `/horario/asignaturas/:id/bloques-externos` | `{ bloques: [BloqueExterno] }`, agrega |
| DELETE | `/horario/asignaturas/:id/bloques-externos/:idBloque` | Quita un bloque de 45 min |
| GET | `/horario/bloques?dia=&id_sala=&origen=` | Todos los bloques con `curso.asignatura`, `sala`, `origen`, `bloqueado` |

`BloqueExterno`:
```json
{ "dia": "LUNES", "bloque_inicio": 1, "bloque_fin": 2, "id_sala": 3 }
{ "dia": "MIERCOLES", "bloque_inicio": 3, "bloque_fin": 4, "sala_externa": "Sala Educación" }
```
Reglas: solo asignaturas `EXTERNA` (400 si es `PROPIA`); exactamente uno de `id_sala` / `sala_externa`; sala activa; **409** si la sala ya tiene clase u ocupación en ese bloque o si la asignatura ya tiene clase ahí. Todo o nada: si un bloque falla no se guarda ninguno.

### Ocupaciones de sala
| Método | Ruta | Notas |
|---|---|---|
| GET | `/horario/ocupaciones?id_sala=&tipo=&dia=&desde=&hasta=` | `desde`/`hasta` (YYYY-MM-DD) filtran las PUNTUALES; las SEMESTRALES siempre vienen |
| GET | `/horario/ocupaciones/:id` | |
| POST | `/horario/ocupaciones` | Ver abajo. Guarda el usuario de la sesión |
| DELETE | `/horario/ocupaciones/:id` | |

```json
{ "tipo": "SEMESTRAL", "dia": "MARTES", "bloque_inicio": 3, "bloque_fin": 4, "id_sala": 3,
  "motivo": "ED556 Uso de TIC", "solicitante": "Pedagogía en Inglés (312)" }
{ "tipo": "PUNTUAL", "fecha": "2027-03-09", "bloque_inicio": 5, "bloque_fin": 6, "id_sala": 3,
  "motivo": "Ayudantía", "solicitante": "Ayudante Juan Pérez" }
```
PUNTUAL: fecha de lunes a viernes, no pasada; el `dia` se deriva. **409** si choca con una clase u otra ocupación.
`fecha` se devuelve como `"YYYY-MM-DD"` (ver *Fechas*).

## Para cada integrante

### Front de Salas — ADM-F01-T3 (Jeremy)
- Listado: `GET /horario/salas`. Mostrar "en uso" si `_count.bloques_horarios + _count.ocupaciones > 0`.
- Eliminar: mostrar `mensaje` de la respuesta; si `accion === 'DESACTIVADA'` la sala sigue en la lista con `activo: false`.
- 409 en crear/editar → mostrar `message` junto al campo nombre/código.

### Front de Asignaturas y grilla — ADM-F02-T4 (Edson)
- Selectores de carrera/plan: `GET /horario/carreras`.
- Grilla: filas de `GET /horario/grilla`, celdas de `GET /horario/bloques` (agrupar por `dia` + `bloque_numero`; bloques seguidos del mismo curso forman una clase).
- CA3: estilo distinto si `origen === 'EXTERNA'`; `cdkDragDisabled="bloque.bloqueado"`.
- Formulario de asignatura externa: enviar `bloques_externos` como rangos de la grilla, no como horas.
- Ocupaciones (`GET /horario/ocupaciones?id_sala=`) se pueden pintar como celdas ocupadas no editables.

### Carga docente y docentes — ADM-F03 / ADM-F05 (Isaac, Gustavo)
- `Carga_Docente.id_curso` → usar el Curso por defecto: `asignatura.cursos[0].id_curso`.
- Agregar la relación `cargas_docentes Carga_Docente[]` en `Curso` (`prisma/schema.prisma`, sección MÓDULO HORARIO) y sumarla a `INCLUDE_ASIGNATURA` en `asignaturas/asignaturas.service.ts` para que el front la reciba.
- `Profesor.id_usuario` debe apuntar a `Usuario.id`.
- Dato real (planillas de carga docente): una asignatura se dicta como cátedra y taller por sección (`HG068-C-A`, `HG068-T-A`), cada uno con horas y docente propios. Si se necesita ese nivel, crear más `Curso` por asignatura en vez de usar solo el por defecto.
- Tipos de contrato en la planilla: `JC`, `CONV`, `ETR`, `TRAN`, `EQUI`.

### Perfiles — ADM-F04 (Jeremy, Gustavo)
- Agregar `RolesGuard` + `@Roles(...)` a los 6 controladores de `src/horario/` (ver *Autenticación*).
- Los roles existentes son `jefatura`, `vinculacion`, `practicas`; `secretaria` y `profesor` aún no existen.

### Generador — Sprint 2
- Nunca mover bloques con `bloqueado = true`.
- No asignar una sala en un bloque con `Bloque_horario` u `Ocupacion_sala` SEMESTRAL en ese `dia`/bloque. Las funciones de `common/choques.ts` sirven de base.

## Al modificar el schema
- Agregar modelos/relaciones; no renombrar ni borrar campos existentes sin acordarlo.
- **Una migración por PR**, con nombre propio, rebaseada sobre `Master-vinculacion` antes de mergear.
- Prisma ordena las migraciones por nombre (timestamp **UTC**). Si se crea a mano, usar hora UTC.

## Fechas
El `DateFormatInterceptor` global formatea todo `Date` de la respuesta como `dd/mm/aaaa` con hora local. Para columnas `@db.Date` (medianoche UTC) eso muestra **un día antes** en Chile. Por eso este módulo devuelve las fechas como string `YYYY-MM-DD`.
