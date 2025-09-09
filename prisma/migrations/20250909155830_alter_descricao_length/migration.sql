/*
  Warnings:

  - You are about to drop the column `serviceDescription` on the `Card` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Card` DROP COLUMN `serviceDescription`,
    ADD COLUMN `descricao` TEXT NULL;
