-- DropIndex
DROP INDEX `asignatura_codigo_key` ON `asignatura`;

-- AlterTable
ALTER TABLE `bloque_horario` MODIFY `bloque_numero` INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `asignatura_id_plan_codigo_semestre_key` ON `asignatura`(`id_plan`, `codigo`, `semestre`);

