# Rama refundida en el PR #35

Esta rama (`feat/CAL-F01-horario-departamento`) **no se va a mergear**. Su trabajo para CAL-F01, CAL-F02 y CAL-F03 se refundió en el **PR #35**: https://github.com/Promajister/GestionAcademica-Clone/pull/35

Las historias de calendario quedaron dentro de **Grilla semanal**:
- **CAL-F01** (HOR-23): vista "Salas libres", con las 6 salas en cada bloque de lunes a viernes.
- **CAL-F02** (HOR-24): filtro de sala.
- **CAL-F03** (HOR-25): filtro de docente con búsqueda por nombre.

Las tres usan los datos de la propuesta guardada, sin un endpoint aparte.

Motivo: el endpoint `horario/calendario/ocupacion-semanal` filtraba por `curso.semestre` (el nivel de la asignatura) en vez del semestre del año. Con "2° Semestre" mostraba solo las clases de nivel 2: 20 de 138 bloques. Además, guardaba una sola clase por celda y la vista no aparecía en el menú de la secretaria.

Decisión del PO (Cristian Gutiérrez), 26/11/2026.
