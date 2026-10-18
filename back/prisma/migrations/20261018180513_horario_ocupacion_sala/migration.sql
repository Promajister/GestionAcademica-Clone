-- CreateTable
CREATE TABLE `ocupacion_sala` (
    `id_ocupacion` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('PUNTUAL', 'SEMESTRAL') NOT NULL,
    `fecha` DATE NULL,
    `dia` ENUM('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES') NOT NULL,
    `bloque_inicio` INTEGER NOT NULL,
    `bloque_fin` INTEGER NOT NULL,
    `hora_inicio` VARCHAR(10) NOT NULL,
    `hora_fin` VARCHAR(10) NOT NULL,
    `motivo` VARCHAR(255) NOT NULL,
    `solicitante` VARCHAR(150) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id_sala` INTEGER NOT NULL,
    `id_usuario` INTEGER NOT NULL,

    INDEX `ocupacion_sala_id_sala_dia_idx`(`id_sala`, `dia`),
    PRIMARY KEY (`id_ocupacion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ocupacion_sala` ADD CONSTRAINT `ocupacion_sala_id_sala_fkey` FOREIGN KEY (`id_sala`) REFERENCES `sala`(`id_sala`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ocupacion_sala` ADD CONSTRAINT `ocupacion_sala_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

