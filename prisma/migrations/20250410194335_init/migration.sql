-- CreateTable
CREATE TABLE `Cliente` (
    `id_cliente` INTEGER NOT NULL AUTO_INCREMENT,
    `telefone` VARCHAR(15) NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `sobrenome` VARCHAR(100) NOT NULL,
    `cpf` VARCHAR(14) NULL,
    `data_nascimento` VARCHAR(191) NULL,
    `email` VARCHAR(100) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
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

-- CreateTable
CREATE TABLE `Card` (
    `id_pedido` VARCHAR(191) NOT NULL,
    `id_cliente` INTEGER NOT NULL,
    `id_prestador` INTEGER NOT NULL,
    `categoria` VARCHAR(191) NOT NULL,
    `subcategoria` VARCHAR(191) NOT NULL,
    `valor` VARCHAR(191) NOT NULL,
    `horario_preferencial` VARCHAR(191) NOT NULL,
    `codigo_confirmacao` VARCHAR(191) NULL,
    `data_finalizacao` VARCHAR(191) NULL,
    `status_pedido` VARCHAR(191) NOT NULL,
    `cep` VARCHAR(191) NOT NULL,
    `street` VARCHAR(191) NOT NULL,
    `neighborhood` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `complement` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id_pedido`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidaturas` (
    `pedido_id` VARCHAR(191) NOT NULL,
    `prestador_id` VARCHAR(191) NULL,
    `valor_negociado` VARCHAR(191) NULL,
    `horario_negociado` VARCHAR(191) NULL,
    `data_candidatura` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`pedido_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Card` ADD CONSTRAINT `Card_id_cliente_fkey` FOREIGN KEY (`id_cliente`) REFERENCES `Cliente`(`id_cliente`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidaturas` ADD CONSTRAINT `candidaturas_pedido_id_fkey` FOREIGN KEY (`pedido_id`) REFERENCES `Card`(`id_pedido`) ON DELETE RESTRICT ON UPDATE CASCADE;
