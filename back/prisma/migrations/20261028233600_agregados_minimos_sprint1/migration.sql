-- AlterTable
ALTER TABLE `salas` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `horarios_externos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_curso` INTEGER NOT NULL,
    `id_dia` INTEGER NOT NULL,
    `id_bloque` INTEGER NOT NULL,
    `id_sala` INTEGER NULL,
    `sala_externa` VARCHAR(191) NULL,

    UNIQUE INDEX `horarios_externos_id_curso_id_dia_id_bloque_key`(`id_curso`, `id_dia`, `id_bloque`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `salas_nombre_key` ON `salas`(`nombre`);

-- AddForeignKey
ALTER TABLE `horarios_externos` ADD CONSTRAINT `horarios_externos_id_curso_fkey` FOREIGN KEY (`id_curso`) REFERENCES `cursos`(`id_curso`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horarios_externos` ADD CONSTRAINT `horarios_externos_id_dia_fkey` FOREIGN KEY (`id_dia`) REFERENCES `dias`(`id_dia`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horarios_externos` ADD CONSTRAINT `horarios_externos_id_bloque_fkey` FOREIGN KEY (`id_bloque`) REFERENCES `bloques_horarios`(`id_bloque`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horarios_externos` ADD CONSTRAINT `horarios_externos_id_sala_fkey` FOREIGN KEY (`id_sala`) REFERENCES `salas`(`id_sala`) ON DELETE SET NULL ON UPDATE CASCADE;
