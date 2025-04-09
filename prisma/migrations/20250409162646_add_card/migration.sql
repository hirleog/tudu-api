/*
  Warnings:

  - You are about to drop the column `address` on the `card` table. All the data in the column will be lost.
  - You are about to alter the column `categoria` on the `card` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `subcategoria` on the `card` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `horario_preferencial` on the `card` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - Added the required column `cep` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `neighborhood` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `number` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `street` to the `Card` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `card` DROP COLUMN `address`,
    ADD COLUMN `cep` VARCHAR(191) NOT NULL,
    ADD COLUMN `city` VARCHAR(191) NOT NULL,
    ADD COLUMN `complement` VARCHAR(191) NULL,
    ADD COLUMN `neighborhood` VARCHAR(191) NOT NULL,
    ADD COLUMN `number` VARCHAR(191) NOT NULL,
    ADD COLUMN `state` VARCHAR(191) NOT NULL,
    ADD COLUMN `street` VARCHAR(191) NOT NULL,
    MODIFY `categoria` VARCHAR(191) NOT NULL,
    MODIFY `subcategoria` VARCHAR(191) NOT NULL,
    MODIFY `valor` VARCHAR(191) NOT NULL,
    MODIFY `horario_preferencial` VARCHAR(191) NOT NULL;
