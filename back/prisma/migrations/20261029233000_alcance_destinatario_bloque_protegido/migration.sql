-- 1. Eliminar temporalmente la foreign key que depende del índice PRIMARY compuesto
ALTER TABLE `bloques_protegidos` DROP FOREIGN KEY `bloques_protegidos_id_bloque_fkey`;

-- 2. AlterTable: Extender BloqueProtegido con alcance, nombre, destinatario y clave autoincremental
-- Conservando las 6 filas existentes con nombre = 'Horario protegido' y alcance = 'UNIVERSIDAD'
ALTER TABLE `bloques_protegidos`
    DROP PRIMARY KEY,
    ADD COLUMN `id_bloque_protegido` INTEGER NOT NULL AUTO_INCREMENT FIRST,
    ADD COLUMN `nombre` VARCHAR(191) NOT NULL DEFAULT 'Horario protegido',
    ADD COLUMN `alcance` ENUM('UNIVERSIDAD', 'FACULTAD', 'CARRERA', 'ESTUDIANTES', 'PRACTICA_PREPRACTICA', 'ACADEMICOS', 'ACADEMICO_INDIVIDUAL') NOT NULL DEFAULT 'UNIVERSIDAD',
    ADD COLUMN `codigo_carrera` VARCHAR(191) NULL,
    ADD COLUMN `semestre` INTEGER NULL,
    ADD COLUMN `contrato` ENUM('PLANTA', 'HORAS') NULL,
    ADD COLUMN `id_usuario` INTEGER NULL,
    ADD PRIMARY KEY (`id_bloque_protegido`);

-- 3. Recrear foreign key id_bloque
ALTER TABLE `bloques_protegidos` ADD CONSTRAINT `bloques_protegidos_id_bloque_fkey` FOREIGN KEY (`id_bloque`) REFERENCES `bloques_horarios`(`id_bloque`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Remover defaults temporales para coincidir exactamente con el datamodel de Prisma
ALTER TABLE `bloques_protegidos`
    ALTER COLUMN `nombre` DROP DEFAULT,
    ALTER COLUMN `alcance` DROP DEFAULT;

-- 5. Crear índice para búsquedas por día y bloque
CREATE INDEX `bloques_protegidos_id_dia_id_bloque_idx` ON `bloques_protegidos`(`id_dia`, `id_bloque`);

-- 6. Agregar foreign keys de carrera y profesor
ALTER TABLE `bloques_protegidos` ADD CONSTRAINT `bloques_protegidos_codigo_carrera_fkey` FOREIGN KEY (`codigo_carrera`) REFERENCES `carreras`(`codigo`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bloques_protegidos` ADD CONSTRAINT `bloques_protegidos_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `profesores`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;
