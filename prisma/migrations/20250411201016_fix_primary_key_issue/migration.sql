/*
  Warnings:

  - You are about to alter the column `valor_negociado` on the `Candidatura` table. The data in that column could be lost. The data in that column will be cast from `Double` to `VarChar(191)`.

*/
-- AlterTable
ALTER TABLE `Candidatura` MODIFY `valor_negociado` VARCHAR(191) NULL;
