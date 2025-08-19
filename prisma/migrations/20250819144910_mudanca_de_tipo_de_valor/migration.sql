/*
  Warnings:

  - You are about to alter the column `amount` on the `pagamentos` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Int`.
  - You are about to alter the column `reversed_amount` on the `pagamentos` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Int`.

*/
-- AlterTable
ALTER TABLE `pagamentos` MODIFY `amount` INTEGER NOT NULL,
    MODIFY `reversed_amount` INTEGER NULL;
