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

-- AddForeignKey
ALTER TABLE `historial_evento` ADD CONSTRAINT `historial_evento_estudianteRut_fkey` FOREIGN KEY (`estudianteRut`) REFERENCES `estudiante`(`rut`) ON DELETE CASCADE ON UPDATE CASCADE;
