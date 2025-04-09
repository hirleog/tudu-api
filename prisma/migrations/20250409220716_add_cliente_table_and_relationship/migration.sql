/*
  Warnings:

  - You are about to drop the `cliente` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `id_prestador` to the `Card` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `card` DROP FOREIGN KEY `Card_id_cliente_fkey`;

-- DropIndex
DROP INDEX `Card_id_cliente_fkey` ON `card`;

-- AlterTable
ALTER TABLE `card` ADD COLUMN `id_prestador` INTEGER NOT NULL;

-- DropTable
DROP TABLE `cliente`;
