/*
  Warnings:

  - You are about to drop the column `amount` on the `pagamentos` table. All the data in the column will be lost.
  - Added the required column `origin_amount` to the `pagamentos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_amount` to the `pagamentos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `pagamentos` DROP COLUMN `amount`,
    ADD COLUMN `origin_amount` INTEGER NOT NULL,
    ADD COLUMN `total_amount` INTEGER NOT NULL;
