-- AlterTable
ALTER TABLE `Card` ADD COLUMN `horario_negociado` VARCHAR(191) NULL,
    ADD COLUMN `status` BOOLEAN NULL,
    ADD COLUMN `valor_negociado` VARCHAR(191) NULL,
    MODIFY `id_prestador` INTEGER NULL,
    MODIFY `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
