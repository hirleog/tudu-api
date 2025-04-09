/*
  Warnings:

  - Added the required column `codigo_confirmacao` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `data_finalizacao` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `horario_negociado` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `metodo_pagamento` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prestador_id` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status_pedido` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `valor_negociado` to the `Card` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `card` ADD COLUMN `codigo_confirmacao` VARCHAR(191) NOT NULL,
    ADD COLUMN `data_finalizacao` VARCHAR(191) NOT NULL,
    ADD COLUMN `horario_negociado` VARCHAR(191) NOT NULL,
    ADD COLUMN `metodo_pagamento` VARCHAR(191) NOT NULL,
    ADD COLUMN `prestador_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `status_pedido` VARCHAR(191) NOT NULL,
    ADD COLUMN `valor_negociado` VARCHAR(191) NOT NULL;
