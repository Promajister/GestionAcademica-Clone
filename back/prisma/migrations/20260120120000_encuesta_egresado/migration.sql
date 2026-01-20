ALTER TABLE `respuesta_seleccionada` ADD COLUMN `encuestaEgresadoId` INTEGER NULL;

CREATE TABLE `encuesta_egresado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(191) NOT NULL,
    `fecha` DATETIME(3) NULL,
    `generales` JSON NULL,
    `semestreId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `encuesta_egresado` ADD CONSTRAINT `encuesta_egresado_semestreId_fkey` FOREIGN KEY (`semestreId`) REFERENCES `encuesta_semestre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `respuesta_seleccionada` ADD CONSTRAINT `respuesta_seleccionada_encuestaEgresadoId_fkey` FOREIGN KEY (`encuestaEgresadoId`) REFERENCES `encuesta_egresado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
