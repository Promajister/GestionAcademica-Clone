/*
  Warnings:

  - You are about to alter the column `origen` on the `asignaturas` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(7))`.
  - You are about to alter the column `tipo` on the `cursos` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(8))`.
  - You are about to alter the column `nombre` on the `dias` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(10))`.
  - You are about to alter the column `contrato` on the `profesores` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(6))`.
  - You are about to alter the column `tipo` on the `salas` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(9))`.

*/
-- AlterTable
ALTER TABLE `asignaturas` MODIFY `origen` ENUM('EXTERNA', 'INTERNA') NOT NULL;

-- AlterTable
ALTER TABLE `cursos` MODIFY `tipo` ENUM('CATEDRA', 'TALLER', 'LABORATORIO') NOT NULL;

-- AlterTable
ALTER TABLE `dias` MODIFY `nombre` ENUM('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO') NOT NULL;

-- AlterTable
ALTER TABLE `profesores` MODIFY `contrato` ENUM('PLANTA', 'HORAS') NOT NULL;

-- AlterTable
ALTER TABLE `salas` MODIFY `tipo` ENUM('CLASES', 'REUNIONES') NOT NULL;
