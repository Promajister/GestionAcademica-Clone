/*
  Horario pasa a referenciar el curso (no la carga docente) y agrega `estado`
  (ACTIVO / PROPUESTA / BORRADOR) para la generación de propuestas de horario.
*/

-- DropTable
DROP TABLE `horarios`;

-- CreateTable
CREATE TABLE `horarios` (
    `id_curso` INTEGER NOT NULL,
    `id_sala` INTEGER NOT NULL,
    `id_dia` INTEGER NOT NULL,
    `id_bloque` INTEGER NOT NULL,
    `estado` ENUM('ACTIVO', 'PROPUESTA', 'BORRADOR') NOT NULL DEFAULT 'ACTIVO',

    UNIQUE INDEX `horarios_id_curso_id_dia_id_bloque_estado_key`(`id_curso`, `id_dia`, `id_bloque`, `estado`),
    PRIMARY KEY (`id_sala`, `id_dia`, `id_bloque`, `estado`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `horarios` ADD CONSTRAINT `horarios_id_curso_fkey` FOREIGN KEY (`id_curso`) REFERENCES `cursos`(`id_curso`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horarios` ADD CONSTRAINT `horarios_id_dia_fkey` FOREIGN KEY (`id_dia`) REFERENCES `dias`(`id_dia`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horarios` ADD CONSTRAINT `horarios_id_bloque_fkey` FOREIGN KEY (`id_bloque`) REFERENCES `bloques_horarios`(`id_bloque`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horarios` ADD CONSTRAINT `horarios_id_sala_fkey` FOREIGN KEY (`id_sala`) REFERENCES `salas`(`id_sala`) ON DELETE CASCADE ON UPDATE CASCADE;
