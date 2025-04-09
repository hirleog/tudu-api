/*
  Warnings:

  - The primary key for the `card` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `horario_negociado` on the `card` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `card` table. All the data in the column will be lost.
  - You are about to drop the column `prestador_id` on the `card` table. All the data in the column will be lost.
  - You are about to drop the column `valor_negociado` on the `card` table. All the data in the column will be lost.
  - Added the required column `Id_prestador` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_cliente` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_pedido` to the `Card` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `card` DROP PRIMARY KEY,
    DROP COLUMN `horario_negociado`,
    DROP COLUMN `id`,
    DROP COLUMN `prestador_id`,
    DROP COLUMN `valor_negociado`,
    ADD COLUMN `Id_prestador` INTEGER NOT NULL,
    ADD COLUMN `id_cliente` INTEGER NOT NULL,
    ADD COLUMN `id_pedido` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id_pedido`);

-- CreateTable
CREATE TABLE `candidaturas` (
    `pedido_id` INTEGER NOT NULL AUTO_INCREMENT,
    `prestador_id` VARCHAR(191) NULL,
    `valor_negociado` VARCHAR(191) NULL,
    `horario_negociado` VARCHAR(191) NULL,
    `data_candidatura` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`pedido_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `candidaturas` ADD CONSTRAINT `candidaturas_pedido_id_fkey` FOREIGN KEY (`pedido_id`) REFERENCES `Card`(`id_pedido`) ON DELETE RESTRICT ON UPDATE CASCADE;
