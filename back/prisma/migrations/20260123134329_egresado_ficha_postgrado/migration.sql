-- CreateTable
CREATE TABLE `egresado_ficha` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estudianteRut` VARCHAR(191) NOT NULL,
    `nacionalidad` VARCHAR(191) NULL,
    `anioEgreso` INTEGER NULL,
    `notaTitulacion` DOUBLE NULL,
    `fechaDefensa` DATETIME(3) NULL,
    `celular` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `region` VARCHAR(191) NULL,
    `ciudad` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `egresado_ficha_estudianteRut_key`(`estudianteRut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `egresado_postgrado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `egresadoFichaId` INTEGER NOT NULL,
    `tipo` ENUM('DIPLOMADO', 'MAGISTER', 'DOCTORADO', 'OTRO') NOT NULL,
    `institucion` VARCHAR(191) NOT NULL,
    `anioInicio` INTEGER NULL,
    `anioTermino` INTEGER NULL,
    `estado` ENUM('EN_CURSO', 'FINALIZADO') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `egresado_ficha` ADD CONSTRAINT `egresado_ficha_estudianteRut_fkey` FOREIGN KEY (`estudianteRut`) REFERENCES `estudiante`(`rut`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `egresado_postgrado` ADD CONSTRAINT `egresado_postgrado_egresadoFichaId_fkey` FOREIGN KEY (`egresadoFichaId`) REFERENCES `egresado_ficha`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
