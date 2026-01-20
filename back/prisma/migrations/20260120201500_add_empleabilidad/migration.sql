-- CreateTable
CREATE TABLE `empleabilidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estudianteRut` VARCHAR(191) NOT NULL,
    `lugarTrabajo` VARCHAR(191) NOT NULL,
    `sector` VARCHAR(191) NOT NULL,
    `sectorOtro` VARCHAR(191) NULL,
    `cargo` VARCHAR(191) NOT NULL,
    `cargoOtro` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `empleabilidad_estudianteRut_key`(`estudianteRut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `empleabilidad` ADD CONSTRAINT `empleabilidad_estudianteRut_fkey` FOREIGN KEY (`estudianteRut`) REFERENCES `estudiante`(`rut`) ON DELETE CASCADE ON UPDATE CASCADE;
