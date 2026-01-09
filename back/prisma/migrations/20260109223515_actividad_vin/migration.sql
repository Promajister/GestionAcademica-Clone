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
CREATE TABLE `actividad_vinculacion_unidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `actividadVinculacionId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividad_vinculacion_responsable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rut` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `actividadVinculacionId` INTEGER NOT NULL,

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

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_unidad` ADD CONSTRAINT `actividad_vinculacion_unidad_actividadVinculacionId_fkey` FOREIGN KEY (`actividadVinculacionId`) REFERENCES `actividad_vinculacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividad_vinculacion_responsable` ADD CONSTRAINT `actividad_vinculacion_responsable_actividadVinculacionId_fkey` FOREIGN KEY (`actividadVinculacionId`) REFERENCES `actividad_vinculacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
