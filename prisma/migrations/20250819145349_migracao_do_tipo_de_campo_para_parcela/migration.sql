/*
  Warnings:

  - You are about to alter the column `installments_amount` on the `pagamentos` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Int`.

*/
-- AlterTable
ALTER TABLE `pagamentos` MODIFY `installments_amount` INTEGER NULL;
