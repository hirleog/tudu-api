-- AlterTable
ALTER TABLE `card` MODIFY `codigo_confirmacao` VARCHAR(191) NULL,
    MODIFY `data_finalizacao` VARCHAR(191) NULL,
    MODIFY `horario_negociado` VARCHAR(191) NULL,
    MODIFY `metodo_pagamento` VARCHAR(191) NULL,
    MODIFY `prestador_id` VARCHAR(191) NULL,
    MODIFY `valor_negociado` VARCHAR(191) NULL;
