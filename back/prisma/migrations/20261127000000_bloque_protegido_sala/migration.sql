-- AlterTable
ALTER TABLE `bloques_protegidos` ADD COLUMN `id_sala` INTEGER NULL,
    MODIFY `alcance` ENUM('UNIVERSIDAD', 'FACULTAD', 'CARRERA', 'ESTUDIANTES', 'PRACTICA_PREPRACTICA', 'ACADEMICOS', 'ACADEMICO_INDIVIDUAL', 'SALA') NOT NULL;

-- AddForeignKey
ALTER TABLE `bloques_protegidos` ADD CONSTRAINT `bloques_protegidos_id_sala_fkey` FOREIGN KEY (`id_sala`) REFERENCES `salas`(`id_sala`) ON DELETE CASCADE ON UPDATE CASCADE;

