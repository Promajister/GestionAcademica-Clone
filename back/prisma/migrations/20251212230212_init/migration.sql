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
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Usuario_email_key`(`email`),
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

-- AddForeignKey
ALTER TABLE `practica` ADD CONSTRAINT `practica_estudianteRut_fkey` FOREIGN KEY (`estudianteRut`) REFERENCES `estudiante`(`rut`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practica` ADD CONSTRAINT `practica_centroId_fkey` FOREIGN KEY (`centroId`) REFERENCES `centro_educativo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trabajador_educ` ADD CONSTRAINT `trabajador_educ_centroId_fkey` FOREIGN KEY (`centroId`) REFERENCES `centro_educativo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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
