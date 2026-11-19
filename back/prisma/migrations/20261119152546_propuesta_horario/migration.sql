-- CreateTable
CREATE TABLE `periodos_horario` (
    `year` INTEGER NOT NULL,
    `periodo` INTEGER NOT NULL,
    `estado` ENUM('BORRADOR', 'CERRADO') NOT NULL DEFAULT 'BORRADOR',
    `generado_en` DATETIME(3) NULL,
    `cerrado_en` DATETIME(3) NULL,
    `no_asignadas` JSON NULL,

    PRIMARY KEY (`year`, `periodo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

