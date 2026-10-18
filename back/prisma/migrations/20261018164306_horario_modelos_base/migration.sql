-- CreateTable
CREATE TABLE `sala` (
    `id_sala` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(30) NOT NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `capacidad` INTEGER NOT NULL DEFAULT 22,
    `tipo` ENUM('CLASES', 'REUNION') NOT NULL DEFAULT 'CLASES',
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `sala_codigo_key`(`codigo`),
    UNIQUE INDEX `sala_nombre_key`(`nombre`),
    PRIMARY KEY (`id_sala`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carrera` (
    `id_carrera` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(20) NOT NULL,
    `nombre` VARCHAR(150) NOT NULL,

    UNIQUE INDEX `carrera_codigo_key`(`codigo`),
    PRIMARY KEY (`id_carrera`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan` (
    `id_plan` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(150) NOT NULL,
    `anio` INTEGER NOT NULL,
    `vigente` BOOLEAN NOT NULL DEFAULT true,
    `id_carrera` INTEGER NOT NULL,

    PRIMARY KEY (`id_plan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asignatura` (
    `id_asignatura` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(30) NOT NULL,
    `nombre` VARCHAR(150) NOT NULL,
    `semestre` INTEGER NOT NULL,
    `cupo` INTEGER NOT NULL DEFAULT 22,
    `bloques_semanales` INTEGER NOT NULL,
    `origen` ENUM('PROPIA', 'EXTERNA') NOT NULL DEFAULT 'PROPIA',
    `id_plan` INTEGER NOT NULL,

    UNIQUE INDEX `asignatura_codigo_key`(`codigo`),
    PRIMARY KEY (`id_asignatura`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `curso` (
    `id_curso` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(150) NOT NULL,
    `tipo` VARCHAR(50) NOT NULL DEFAULT 'REGULAR',
    `id_asignatura` INTEGER NOT NULL,

    PRIMARY KEY (`id_curso`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `horario` (
    `id_horario` INTEGER NOT NULL AUTO_INCREMENT,
    `anio` INTEGER NOT NULL,
    `semestre` INTEGER NOT NULL,
    `estado` ENUM('BORRADOR', 'PROPUESTA', 'DEFINITIVO') NOT NULL DEFAULT 'BORRADOR',

    PRIMARY KEY (`id_horario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bloque_horario` (
    `id_bloque_horario` INTEGER NOT NULL AUTO_INCREMENT,
    `dia` ENUM('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES') NOT NULL,
    `hora_inicio` VARCHAR(10) NOT NULL,
    `hora_fin` VARCHAR(10) NOT NULL,
    `bloque_numero` INTEGER NULL,
    `bloqueado` BOOLEAN NOT NULL DEFAULT false,
    `sala_externa` VARCHAR(100) NULL,
    `id_curso` INTEGER NOT NULL,
    `id_sala` INTEGER NULL,
    `id_horario` INTEGER NULL,

    PRIMARY KEY (`id_bloque_horario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `plan` ADD CONSTRAINT `plan_id_carrera_fkey` FOREIGN KEY (`id_carrera`) REFERENCES `carrera`(`id_carrera`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asignatura` ADD CONSTRAINT `asignatura_id_plan_fkey` FOREIGN KEY (`id_plan`) REFERENCES `plan`(`id_plan`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curso` ADD CONSTRAINT `curso_id_asignatura_fkey` FOREIGN KEY (`id_asignatura`) REFERENCES `asignatura`(`id_asignatura`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bloque_horario` ADD CONSTRAINT `bloque_horario_id_curso_fkey` FOREIGN KEY (`id_curso`) REFERENCES `curso`(`id_curso`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bloque_horario` ADD CONSTRAINT `bloque_horario_id_sala_fkey` FOREIGN KEY (`id_sala`) REFERENCES `sala`(`id_sala`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bloque_horario` ADD CONSTRAINT `bloque_horario_id_horario_fkey` FOREIGN KEY (`id_horario`) REFERENCES `horario`(`id_horario`) ON DELETE SET NULL ON UPDATE CASCADE;
