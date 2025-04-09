-- CreateTable
CREATE TABLE `Card` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoria` VARCHAR(255) NOT NULL,
    `subcategoria` VARCHAR(255) NOT NULL,
    `valor` VARCHAR(50) NOT NULL,
    `horario_preferencial` VARCHAR(255) NOT NULL,
    `address` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
