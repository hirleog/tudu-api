/*
  Warnings:

  - You are about to drop the column `Id_prestador` on the `card` table. All the data in the column will be lost.
  - You are about to drop the column `metodo_pagamento` on the `card` table. All the data in the column will be lost.
  - Added the required column `id_prestador` to the `Card` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `card` DROP COLUMN `Id_prestador`,
    DROP COLUMN `metodo_pagamento`,
    ADD COLUMN `id_prestador` INTEGER NOT NULL;
