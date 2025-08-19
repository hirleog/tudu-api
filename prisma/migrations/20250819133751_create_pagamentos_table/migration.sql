-- CreateTable
CREATE TABLE `pagamentos` (
    `id_pagamento` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pedido` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `auth_code` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `response_description` VARCHAR(191) NULL,
    `type` VARCHAR(191) NULL,
    `host` VARCHAR(191) NULL,
    `installments` INTEGER NULL,
    `installments_amount` DECIMAL(10, 2) NULL,
    `authorization_date` DATETIME(3) NULL,
    `capture_date` DATETIME(3) NULL,
    `reversed_amount` DECIMAL(10, 2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id_pagamento`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
