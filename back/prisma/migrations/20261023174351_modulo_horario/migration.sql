/*
  Warnings:

  - You are about to drop the `asignatura` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bloque_horario` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `carrera` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `curso` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `horario` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ocupacion_sala` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sala` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `asignatura` DROP FOREIGN KEY `asignatura_id_plan_fkey`;

-- DropForeignKey
ALTER TABLE `bloque_horario` DROP FOREIGN KEY `bloque_horario_id_curso_fkey`;

-- DropForeignKey
ALTER TABLE `bloque_horario` DROP FOREIGN KEY `bloque_horario_id_horario_fkey`;

-- DropForeignKey
ALTER TABLE `bloque_horario` DROP FOREIGN KEY `bloque_horario_id_sala_fkey`;

-- DropForeignKey
ALTER TABLE `curso` DROP FOREIGN KEY `curso_id_asignatura_fkey`;

-- DropForeignKey
ALTER TABLE `ocupacion_sala` DROP FOREIGN KEY `ocupacion_sala_id_sala_fkey`;

-- DropForeignKey
ALTER TABLE `ocupacion_sala` DROP FOREIGN KEY `ocupacion_sala_id_usuario_fkey`;

-- DropForeignKey
ALTER TABLE `plan` DROP FOREIGN KEY `plan_id_carrera_fkey`;

-- DropTable
DROP TABLE `asignatura`;

-- DropTable
DROP TABLE `bloque_horario`;

-- DropTable
DROP TABLE `carrera`;

-- DropTable
DROP TABLE `curso`;

-- DropTable
DROP TABLE `horario`;

-- DropTable
DROP TABLE `ocupacion_sala`;

-- DropTable
DROP TABLE `plan`;

-- DropTable
DROP TABLE `sala`;

-- CreateTable
CREATE TABLE `profesores` (
    `id_usuario` INTEGER NOT NULL,
    `contrato` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id_usuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carreras` (
    `codigo` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `planes` (
    `id_plan` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `codigo_carrera` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id_plan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asignaturas` (
    `codigo` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `catedraSemanal` INTEGER NOT NULL,
    `tallerSemanal` INTEGER NOT NULL,
    `labSemanal` INTEGER NOT NULL,
    `origen` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cursos` (
    `id_curso` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(191) NOT NULL,
    `grupo` VARCHAR(191) NOT NULL,
    `inscritos` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `semestre` INTEGER NOT NULL,
    `codigo_asignatura` VARCHAR(191) NOT NULL,
    `id_malla` INTEGER NULL,

    PRIMARY KEY (`id_curso`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mallas` (
    `id_malla` INTEGER NOT NULL AUTO_INCREMENT,
    `semestre` INTEGER NOT NULL,
    `id_plan` INTEGER NOT NULL,
    `codigo_asignatura` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id_malla`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salas` (
    `id_sala` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `capacidad` INTEGER NOT NULL,

    PRIMARY KEY (`id_sala`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bloques_horarios` (
    `id_bloque` INTEGER NOT NULL AUTO_INCREMENT,
    `horaInicio` VARCHAR(191) NOT NULL,
    `horaFin` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id_bloque`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dias` (
    `id_dia` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id_dia`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bloques_protegidos` (
    `id_bloque` INTEGER NOT NULL,
    `id_dia` INTEGER NOT NULL,

    PRIMARY KEY (`id_bloque`, `id_dia`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `disponibilidades` (
    `id_usuario` INTEGER NOT NULL,
    `id_bloque` INTEGER NOT NULL,
    `id_dia` INTEGER NOT NULL,

    PRIMARY KEY (`id_usuario`, `id_bloque`, `id_dia`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ocupaciones_puntuales` (
    `fecha` DATETIME(3) NOT NULL,
    `id_bloque` INTEGER NOT NULL,
    `id_sala` INTEGER NOT NULL,

    PRIMARY KEY (`id_bloque`, `id_sala`, `fecha`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cargas_docentes` (
    `id_carga` INTEGER NOT NULL AUTO_INCREMENT,
    `cantidad_horas` INTEGER NOT NULL,
    `id_usuario` INTEGER NOT NULL,
    `id_curso` INTEGER NOT NULL,

    PRIMARY KEY (`id_carga`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `horarios` (
    `id_dia` INTEGER NOT NULL,
    `id_bloque` INTEGER NOT NULL,
    `id_sala` INTEGER NOT NULL,
    `id_carga` INTEGER NOT NULL,

    PRIMARY KEY (`id_carga`, `id_sala`, `id_dia`, `id_bloque`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `profesores` ADD CONSTRAINT `profesores_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `planes` ADD CONSTRAINT `planes_codigo_carrera_fkey` FOREIGN KEY (`codigo_carrera`) REFERENCES `carreras`(`codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cursos` ADD CONSTRAINT `cursos_codigo_asignatura_fkey` FOREIGN KEY (`codigo_asignatura`) REFERENCES `asignaturas`(`codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cursos` ADD CONSTRAINT `cursos_id_malla_fkey` FOREIGN KEY (`id_malla`) REFERENCES `mallas`(`id_malla`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mallas` ADD CONSTRAINT `mallas_id_plan_fkey` FOREIGN KEY (`id_plan`) REFERENCES `planes`(`id_plan`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mallas` ADD CONSTRAINT `mallas_codigo_asignatura_fkey` FOREIGN KEY (`codigo_asignatura`) REFERENCES `asignaturas`(`codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bloques_protegidos` ADD CONSTRAINT `bloques_protegidos_id_bloque_fkey` FOREIGN KEY (`id_bloque`) REFERENCES `bloques_horarios`(`id_bloque`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bloques_protegidos` ADD CONSTRAINT `bloques_protegidos_id_dia_fkey` FOREIGN KEY (`id_dia`) REFERENCES `dias`(`id_dia`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disponibilidades` ADD CONSTRAINT `disponibilidades_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `profesores`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disponibilidades` ADD CONSTRAINT `disponibilidades_id_bloque_fkey` FOREIGN KEY (`id_bloque`) REFERENCES `bloques_horarios`(`id_bloque`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disponibilidades` ADD CONSTRAINT `disponibilidades_id_dia_fkey` FOREIGN KEY (`id_dia`) REFERENCES `dias`(`id_dia`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ocupaciones_puntuales` ADD CONSTRAINT `ocupaciones_puntuales_id_bloque_fkey` FOREIGN KEY (`id_bloque`) REFERENCES `bloques_horarios`(`id_bloque`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ocupaciones_puntuales` ADD CONSTRAINT `ocupaciones_puntuales_id_sala_fkey` FOREIGN KEY (`id_sala`) REFERENCES `salas`(`id_sala`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cargas_docentes` ADD CONSTRAINT `cargas_docentes_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `profesores`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cargas_docentes` ADD CONSTRAINT `cargas_docentes_id_curso_fkey` FOREIGN KEY (`id_curso`) REFERENCES `cursos`(`id_curso`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horarios` ADD CONSTRAINT `horarios_id_dia_fkey` FOREIGN KEY (`id_dia`) REFERENCES `dias`(`id_dia`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horarios` ADD CONSTRAINT `horarios_id_bloque_fkey` FOREIGN KEY (`id_bloque`) REFERENCES `bloques_horarios`(`id_bloque`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horarios` ADD CONSTRAINT `horarios_id_sala_fkey` FOREIGN KEY (`id_sala`) REFERENCES `salas`(`id_sala`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horarios` ADD CONSTRAINT `horarios_id_carga_fkey` FOREIGN KEY (`id_carga`) REFERENCES `cargas_docentes`(`id_carga`) ON DELETE CASCADE ON UPDATE CASCADE;
