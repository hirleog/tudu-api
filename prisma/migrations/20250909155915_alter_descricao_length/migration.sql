/*
  Warnings:

  - You are about to drop the column `descricao` on the `Card` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Card` DROP COLUMN `descricao`,
    ADD COLUMN `serviceDescription` TEXT NULL;
