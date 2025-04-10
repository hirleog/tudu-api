-- CreateTable
CREATE TABLE `Cliente` (
    `id_cliente` INTEGER NOT NULL AUTO_INCREMENT,
    `telefone` VARCHAR(15) NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `sobrenome` VARCHAR(100) NOT NULL,
    `cpf` VARCHAR(14) NULL,
    `data_nascimento` DATETIME(3) NULL,
    `email` VARCHAR(100) NOT NULL,
    `endereco_estado` VARCHAR(50) NULL,
    `endereco_cidade` VARCHAR(100) NULL,
    `endereco_bairro` VARCHAR(100) NULL,
    `endereco_rua` VARCHAR(100) NULL,
    `endereco_numero` VARCHAR(10) NULL,
    `data_cadastro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(50) NOT NULL DEFAULT 'Ativo',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Cliente_cpf_key`(`cpf`),
    UNIQUE INDEX `Cliente_email_key`(`email`),
    PRIMARY KEY (`id_cliente`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Card` ADD CONSTRAINT `Card_id_cliente_fkey` FOREIGN KEY (`id_cliente`) REFERENCES `Cliente`(`id_cliente`) ON DELETE RESTRICT ON UPDATE CASCADE;
