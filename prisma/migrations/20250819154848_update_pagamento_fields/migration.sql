/*
  Warnings:

  - The primary key for the `pagamentos` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `id` to the `pagamentos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `pagamentos` DROP PRIMARY KEY,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `id_pagamento` VARCHAR(191) NULL,
    ADD PRIMARY KEY (`id`);
