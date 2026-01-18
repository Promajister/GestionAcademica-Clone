-- AlterTable
ALTER TABLE `respuesta_seleccionada` ADD COLUMN `encuestaJefaturaId` INTEGER NULL;

-- CreateTable
CREATE TABLE `encuesta_jefatura` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subtipo` VARCHAR(191) NOT NULL,
    `fecha` DATETIME(3) NULL,
    `actividadVinculacionId` INTEGER NULL,
    `identificacion` JSON NULL,
    `semestreId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `encuesta_jefatura` ADD CONSTRAINT `encuesta_jefatura_semestreId_fkey` FOREIGN KEY (`semestreId`) REFERENCES `encuesta_semestre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `respuesta_seleccionada` ADD CONSTRAINT `respuesta_seleccionada_encuestaJefaturaId_fkey` FOREIGN KEY (`encuestaJefaturaId`) REFERENCES `encuesta_jefatura`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
