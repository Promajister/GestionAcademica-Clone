-- CreateTable
CREATE TABLE `estudiante` (
    `rut` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `genero` VARCHAR(191) NULL,
    `anio_nacimiento` DATETIME(3) NULL,
    `anio_ingreso` INTEGER NULL,
    `plan` VARCHAR(191) NULL,
    `avance` DOUBLE NULL,
    `puntaje_ponderado` DOUBLE NULL,
    `puntaje_psu` DOUBLE NULL,
    `promedio` DOUBLE NULL,
    `fono` INTEGER NULL,
    `email` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `sistema_ingreso` VARCHAR(191) NULL,
    `numero_inscripciones` INTEGER NULL,

    PRIMARY KEY (`rut`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `practica` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estado` ENUM('En Curso', 'Aprobado', 'Reprobado') NOT NULL,
    `nota_final` DOUBLE NULL,
    `fecha_inicio` DATETIME(3) NOT NULL,
    `fecha_termino` DATETIME(3) NULL,
    `tipo` VARCHAR(191) NULL,
    `estudianteRut` VARCHAR(191) NOT NULL,
    `centroId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `centro_educativo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NULL,
    `comuna` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `telefono` INTEGER NULL,
    `correo` VARCHAR(191) NULL,
    `tipo` ENUM('PARTICULAR', 'PARTICULAR SUBVENCIONADO', 'SLEP', 'NO_CONVENCIONAL') NULL,
    `convenio` VARCHAR(191) NULL,
    `url_rrss` VARCHAR(191) NULL,
    `fecha_inicio_asociacion` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trabajador_educ` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rut` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `rol` VARCHAR(191) NULL,
    `correo` VARCHAR(191) NULL,
    `telefono` INTEGER NULL,
    `centroId` INTEGER NOT NULL,

    UNIQUE INDEX `trabajador_educ_rut_key`(`rut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `colaborador` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rut` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `telefono` INTEGER NULL,
    `universidad_egreso` VARCHAR(191) NULL,

    UNIQUE INDEX `colaborador_rut_key`(`rut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mes` VARCHAR(191) NOT NULL,
    `nombre_actividad` VARCHAR(191) NOT NULL,
    `estudiantes` VARCHAR(191) NULL,
    `terceros_asistieron` BOOLEAN NOT NULL DEFAULT false,
    `fecha` DATETIME(3) NOT NULL,
    `horario` VARCHAR(191) NULL,
    `lugar` VARCHAR(191) NULL,
    `archivo_adjunto` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `rolId` INTEGER NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `fotoUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Usuario_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rol` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clave` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NULL,

    UNIQUE INDEX `rol_clave_key`(`clave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permiso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clave` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,

    UNIQUE INDEX `permiso_clave_key`(`clave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `encuesta_semestre` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anio` INTEGER NOT NULL,
    `semestre` INTEGER NOT NULL,
    `archivo_adjunto` VARCHAR(191) NULL,

    UNIQUE INDEX `encuesta_semestre_anio_semestre_key`(`anio`, `semestre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `used` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `password_reset_tokens_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `hashedToken` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `refresh_tokens_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `encuesta_estudiante` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_estudiante` VARCHAR(191) NOT NULL,
    `nombre_tallerista` VARCHAR(191) NULL,
    `nombre_centro` VARCHAR(191) NULL,
    `nombre_colaborador` VARCHAR(191) NULL,
    `fecha` DATETIME(3) NULL,
    `observacion` TEXT NULL,
    `tipo_practica` VARCHAR(191) NULL,
    `nombre_docente_colaborador_opcional` INTEGER NULL,
    `semestreId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_encuesta_estudiante` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `encuestaId` INTEGER NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `orden` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `encuesta_colaborador` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_colaborador` VARCHAR(191) NOT NULL,
    `nombre_colegio` VARCHAR(191) NULL,
    `observacion` TEXT NULL,
    `tipo_practica` VARCHAR(191) NULL,
    `fecha` DATETIME(3) NULL,
    `semestreId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_encuesta_colaborador` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `encuestaId` INTEGER NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `orden` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pregunta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `descripcion` VARCHAR(191) NOT NULL,
    `tipo` ENUM('ABIERTA', 'CERRADA') NOT NULL,
    `respuestaAbierta` LONGTEXT NULL,
    `itemEstudianteId` INTEGER NULL,
    `itemColaboradorId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alternativa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `descripcion` VARCHAR(191) NOT NULL,
    `puntaje` INTEGER NOT NULL,
    `preguntaId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `respuesta_seleccionada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `encuestaEstudianteId` INTEGER NULL,
    `encuestaColaboradorId` INTEGER NULL,
    `preguntaId` INTEGER NOT NULL,
    `alternativaId` INTEGER NULL,
    `respuestaAbierta` LONGTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historial_evento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estudianteRut` VARCHAR(191) NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tipo` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NULL,
    `descripcion` TEXT NULL,
    `responsable` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `historial_evento_estudianteRut_fecha_idx`(`estudianteRut`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tutor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rut` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `telefono` INTEGER NULL,
    `universidad_egreso` VARCHAR(191) NULL,

    UNIQUE INDEX `tutor_rut_key`(`rut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carta_solicitud` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero_folio` VARCHAR(191) NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `direccion_emisor` VARCHAR(191) NULL,
    `url_archivo` VARCHAR(191) NULL,

    UNIQUE INDEX `carta_solicitud_numero_folio_key`(`numero_folio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `practica_colaborador` (
    `practicaId` INTEGER NOT NULL,
    `colaboradorId` INTEGER NOT NULL,

    PRIMARY KEY (`practicaId`, `colaboradorId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `practica_tutor` (
    `practicaId` INTEGER NOT NULL,
    `tutorId` INTEGER NOT NULL,
    `rol` ENUM('Supervisor', 'Tallerista') NOT NULL,

    PRIMARY KEY (`practicaId`, `tutorId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cargo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cargo` VARCHAR(191) NOT NULL,
    `tutorId` INTEGER NULL,
    `colaboradorId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `observacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `descripcion` TEXT NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `practicaId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad_vinculacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipoActividad` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `objetivo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `tipoVinculacion` VARCHAR(191) NOT NULL,
    `areaVinculacion` VARCHAR(191) NOT NULL,
    `areaImpacto` VARCHAR(191) NOT NULL,
    `sede` VARCHAR(191) NOT NULL,
    `fechaInicio` DATETIME(3) NOT NULL,
    `fechaTermino` DATETIME(3) NOT NULL,
    `lugar` VARCHAR(191) NULL,
    `ingresos` INTEGER NOT NULL DEFAULT 0,
    `proyecto` VARCHAR(191) NULL,
    `resultados` VARCHAR(191) NULL,
    `medioDifusion` VARCHAR(191) NULL,
    `urlDifusion` VARCHAR(191) NULL,
    `enlaceNoticia` VARCHAR(191) NULL,
    `observaciones` VARCHAR(191) NULL,
    `institucionVisitada` VARCHAR(191) NULL,
    `temaCentral` VARCHAR(191) NULL,
    `talleres` VARCHAR(191) NULL,
    `responsableTaller` VARCHAR(191) NULL,
    `asignaturaRemedial` VARCHAR(191) NULL,
    `competenciaAReforzar` VARCHAR(191) NULL,
    `numeroEstudiantesBeneficiados` INTEGER NULL,
    `nombreEvento` VARCHAR(191) NULL,
    `ponenciaPresentada` VARCHAR(191) NULL,
    `relator` VARCHAR(191) NULL,
    `colegioAsociado` VARCHAR(191) NULL,
    `docenteColaborador` VARCHAR(191) NULL,
    `asignaturaAlternancia` VARCHAR(191) NULL,
    `curso` VARCHAR(191) NULL,
    `docenteAsignatura` VARCHAR(191) NULL,
    `nombreActividadAlternancia` VARCHAR(191) NULL,
    `objetivoPedagogico` VARCHAR(191) NULL,
    `asignaturaVinculada` VARCHAR(191) NULL,
    `profesorResponsable` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `unidad_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad_vinculacion_unidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actividadVinculacionId` INTEGER NOT NULL,
    `unidadId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `responsable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rut` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `responsable_rut_key`(`rut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad_vinculacion_responsable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actividadVinculacionId` INTEGER NOT NULL,
    `responsableId` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad_vinculacion_equipo_trabajo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rut` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `equipo` VARCHAR(191) NOT NULL,
    `actividadVinculacionId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad_vinculacion_financiamiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoria` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `monto` INTEGER NOT NULL,
    `actividadVinculacionId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad_vinculacion_centro_costo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `actividadVinculacionId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad_vinculacion_matriz_participantes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipoParticipante` VARCHAR(191) NOT NULL,
    `directivosUta` INTEGER NOT NULL DEFAULT 0,
    `docentesUta` INTEGER NOT NULL DEFAULT 0,
    `estudiantesUta` INTEGER NOT NULL DEFAULT 0,
    `funcionariosGestionUta` INTEGER NOT NULL DEFAULT 0,
    `exalumnos` INTEGER NOT NULL DEFAULT 0,
    `otrosExternos` INTEGER NOT NULL DEFAULT 0,
    `actividadVinculacionId` INTEGER NOT NULL,

    UNIQUE INDEX `actividad_vinculacion_matriz_participantes_actividadVinculac_key`(`actividadVinculacionId`, `tipoParticipante`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad_vinculacion_institucion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `actividadVinculacionId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad_vinculacion_archivo_evidencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actividadVinculacionId` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad_vinculacion_estudiante` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rut` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `actividadVinculacionId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_RolPermisos` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_RolPermisos_AB_unique`(`A`, `B`),
    INDEX `_RolPermisos_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `practica` ADD CONSTRAINT `practica_estudianteRut_fkey` FOREIGN KEY (`estudianteRut`) REFERENCES `estudiante`(`rut`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practica` ADD CONSTRAINT `practica_centroId_fkey` FOREIGN KEY (`centroId`) REFERENCES `centro_educativo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trabajador_educ` ADD CONSTRAINT `trabajador_educ_centroId_fkey` FOREIGN KEY (`centroId`) REFERENCES `centro_educativo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_rolId_fkey` FOREIGN KEY (`rolId`) REFERENCES `rol`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `encuesta_estudiante` ADD CONSTRAINT `encuesta_estudiante_semestreId_fkey` FOREIGN KEY (`semestreId`) REFERENCES `encuesta_semestre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_encuesta_estudiante` ADD CONSTRAINT `item_encuesta_estudiante_encuestaId_fkey` FOREIGN KEY (`encuestaId`) REFERENCES `encuesta_estudiante`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `encuesta_colaborador` ADD CONSTRAINT `encuesta_colaborador_semestreId_fkey` FOREIGN KEY (`semestreId`) REFERENCES `encuesta_semestre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_encuesta_colaborador` ADD CONSTRAINT `item_encuesta_colaborador_encuestaId_fkey` FOREIGN KEY (`encuestaId`) REFERENCES `encuesta_colaborador`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pregunta` ADD CONSTRAINT `pregunta_itemEstudianteId_fkey` FOREIGN KEY (`itemEstudianteId`) REFERENCES `item_encuesta_estudiante`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pregunta` ADD CONSTRAINT `pregunta_itemColaboradorId_fkey` FOREIGN KEY (`itemColaboradorId`) REFERENCES `item_encuesta_colaborador`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alternativa` ADD CONSTRAINT `alternativa_preguntaId_fkey` FOREIGN KEY (`preguntaId`) REFERENCES `pregunta`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `respuesta_seleccionada` ADD CONSTRAINT `respuesta_seleccionada_encuestaEstudianteId_fkey` FOREIGN KEY (`encuestaEstudianteId`) REFERENCES `encuesta_estudiante`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `respuesta_seleccionada` ADD CONSTRAINT `respuesta_seleccionada_encuestaColaboradorId_fkey` FOREIGN KEY (`encuestaColaboradorId`) REFERENCES `encuesta_colaborador`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `respuesta_seleccionada` ADD CONSTRAINT `respuesta_seleccionada_preguntaId_fkey` FOREIGN KEY (`preguntaId`) REFERENCES `pregunta`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `respuesta_seleccionada` ADD CONSTRAINT `respuesta_seleccionada_alternativaId_fkey` FOREIGN KEY (`alternativaId`) REFERENCES `alternativa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_evento` ADD CONSTRAINT `historial_evento_estudianteRut_fkey` FOREIGN KEY (`estudianteRut`) REFERENCES `estudiante`(`rut`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practica_colaborador` ADD CONSTRAINT `practica_colaborador_practicaId_fkey` FOREIGN KEY (`practicaId`) REFERENCES `practica`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practica_colaborador` ADD CONSTRAINT `practica_colaborador_colaboradorId_fkey` FOREIGN KEY (`colaboradorId`) REFERENCES `colaborador`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practica_tutor` ADD CONSTRAINT `practica_tutor_practicaId_fkey` FOREIGN KEY (`practicaId`) REFERENCES `practica`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practica_tutor` ADD CONSTRAINT `practica_tutor_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `tutor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cargo` ADD CONSTRAINT `cargo_tutorId_fkey` FOREIGN KEY (`tutorId`) REFERENCES `tutor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cargo` ADD CONSTRAINT `cargo_colaboradorId_fkey` FOREIGN KEY (`colaboradorId`) REFERENCES `colaborador`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `observacion` ADD CONSTRAINT `observacion_practicaId_fkey` FOREIGN KEY (`practicaId`) REFERENCES `practica`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_unidad` ADD CONSTRAINT `actividad_vinculacion_unidad_actividadVinculacionId_fkey` FOREIGN KEY (`actividadVinculacionId`) REFERENCES `actividad_vinculacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_unidad` ADD CONSTRAINT `actividad_vinculacion_unidad_unidadId_fkey` FOREIGN KEY (`unidadId`) REFERENCES `unidad`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_responsable` ADD CONSTRAINT `actividad_vinculacion_responsable_actividadVinculacionId_fkey` FOREIGN KEY (`actividadVinculacionId`) REFERENCES `actividad_vinculacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_responsable` ADD CONSTRAINT `actividad_vinculacion_responsable_responsableId_fkey` FOREIGN KEY (`responsableId`) REFERENCES `responsable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_equipo_trabajo` ADD CONSTRAINT `actividad_vinculacion_equipo_trabajo_actividadVinculacionId_fkey` FOREIGN KEY (`actividadVinculacionId`) REFERENCES `actividad_vinculacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_financiamiento` ADD CONSTRAINT `actividad_vinculacion_financiamiento_actividadVinculacionId_fkey` FOREIGN KEY (`actividadVinculacionId`) REFERENCES `actividad_vinculacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_centro_costo` ADD CONSTRAINT `actividad_vinculacion_centro_costo_actividadVinculacionId_fkey` FOREIGN KEY (`actividadVinculacionId`) REFERENCES `actividad_vinculacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_matriz_participantes` ADD CONSTRAINT `actividad_vinculacion_matriz_participantes_actividadVincula_fkey` FOREIGN KEY (`actividadVinculacionId`) REFERENCES `actividad_vinculacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_institucion` ADD CONSTRAINT `actividad_vinculacion_institucion_actividadVinculacionId_fkey` FOREIGN KEY (`actividadVinculacionId`) REFERENCES `actividad_vinculacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_archivo_evidencia` ADD CONSTRAINT `actividad_vinculacion_archivo_evidencia_actividadVinculacio_fkey` FOREIGN KEY (`actividadVinculacionId`) REFERENCES `actividad_vinculacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_estudiante` ADD CONSTRAINT `actividad_vinculacion_estudiante_actividadVinculacionId_fkey` FOREIGN KEY (`actividadVinculacionId`) REFERENCES `actividad_vinculacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_RolPermisos` ADD CONSTRAINT `_RolPermisos_A_fkey` FOREIGN KEY (`A`) REFERENCES `permiso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_RolPermisos` ADD CONSTRAINT `_RolPermisos_B_fkey` FOREIGN KEY (`B`) REFERENCES `rol`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
