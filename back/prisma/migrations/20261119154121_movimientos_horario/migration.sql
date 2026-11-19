-- CreateTable
CREATE TABLE `movimientos_horario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `periodo` INTEGER NOT NULL,
    `origen` ENUM('EXTERNA', 'INTERNA') NOT NULL,
    `id_curso` INTEGER NOT NULL,
    `largo` INTEGER NOT NULL,
    `desde_dia` INTEGER NOT NULL,
    `desde_bloque` INTEGER NOT NULL,
    `desde_sala` INTEGER NULL,
    `hacia_dia` INTEGER NOT NULL,
    `hacia_bloque` INTEGER NOT NULL,
    `hacia_sala` INTEGER NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `movimientos_horario_year_periodo_idx`(`year`, `periodo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

