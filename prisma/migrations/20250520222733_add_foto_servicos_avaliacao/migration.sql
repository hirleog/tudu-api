-- AlterTable
ALTER TABLE `Cliente` ADD COLUMN `foto` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Prestador` ADD COLUMN `foto` VARCHAR(191) NULL,
    ADD COLUMN `numero_servicos_feitos` INTEGER NULL;
