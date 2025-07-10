-- CreateTable
CREATE TABLE `Cliente` (
    `id_cliente` INTEGER NOT NULL AUTO_INCREMENT,
    `telefone` VARCHAR(191) NULL,
    `nome` VARCHAR(191) NOT NULL,
    `sobrenome` VARCHAR(191) NOT NULL,
    `cpf` VARCHAR(191) NULL,
    `data_nascimento` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `endereco_estado` VARCHAR(191) NULL,
    `endereco_cidade` VARCHAR(191) NULL,
    `endereco_bairro` VARCHAR(191) NULL,
    `endereco_rua` VARCHAR(191) NULL,
    `endereco_numero` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `foto` VARCHAR(191) NULL,

    UNIQUE INDEX `Cliente_cpf_key`(`cpf`),
    UNIQUE INDEX `Cliente_email_key`(`email`),
    PRIMARY KEY (`id_cliente`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Prestador` (
    `id_prestador` INTEGER NOT NULL AUTO_INCREMENT,
    `telefone` VARCHAR(191) NULL,
    `nome` VARCHAR(191) NOT NULL,
    `sobrenome` VARCHAR(191) NOT NULL,
    `cpf` VARCHAR(191) NULL,
    `data_nascimento` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `endereco_estado` VARCHAR(191) NULL,
    `endereco_cidade` VARCHAR(191) NULL,
    `endereco_bairro` VARCHAR(191) NULL,
    `endereco_rua` VARCHAR(191) NULL,
    `endereco_numero` VARCHAR(191) NULL,
    `especializacao` VARCHAR(191) NULL,
    `descricao` VARCHAR(191) NULL,
    `avaliacao` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `foto` LONGTEXT NULL,
    `numero_servicos_feitos` INTEGER NULL,

    UNIQUE INDEX `Prestador_cpf_key`(`cpf`),
    UNIQUE INDEX `Prestador_email_key`(`email`),
    PRIMARY KEY (`id_prestador`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Candidatura` (
    `id_candidatura` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pedido` VARCHAR(191) NOT NULL,
    `prestador_id` INTEGER NOT NULL,
    `valor_negociado` VARCHAR(191) NULL,
    `horario_negociado` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL,
    `data_candidatura` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Candidatura_id_pedido_prestador_id_key`(`id_pedido`, `prestador_id`),
    PRIMARY KEY (`id_candidatura`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Card` (
    `id_pedido` VARCHAR(191) NOT NULL,
    `id_cliente` INTEGER NOT NULL,
    `id_prestador` INTEGER NULL,
    `categoria` VARCHAR(191) NOT NULL,
    `subcategoria` VARCHAR(191) NOT NULL,
    `serviceDescription` VARCHAR(191) NULL,
    `valor` DECIMAL(65, 30) NOT NULL,
    `horario_preferencial` VARCHAR(191) NOT NULL,
    `valor_negociado_cliente` VARCHAR(191) NULL,
    `horario_negociado_cliente` VARCHAR(191) NULL,
    `codigo_confirmacao` VARCHAR(191) NULL,
    `data_finalizacao` DATETIME(3) NULL,
    `status_pedido` VARCHAR(191) NOT NULL,
    `cep` VARCHAR(191) NOT NULL,
    `street` VARCHAR(191) NOT NULL,
    `neighborhood` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `complement` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id_pedido`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Imagem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
