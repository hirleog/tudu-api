/*
  Warnings:

  - The primary key for the `card` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `cardTitle` on the `card` table. All the data in the column will be lost.
  - You are about to drop the column `dateTimeSelected` on the `card` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `card` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `card` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to drop the `addresscontent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `filtercategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `filteroption` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[addressId]` on the table `Card` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `addressId` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoria` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `horario_preferencial` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subcategoria` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `valor` to the `Card` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `addresscontent` DROP FOREIGN KEY `AddressContent_cardId_fkey`;

-- DropForeignKey
ALTER TABLE `filtercategory` DROP FOREIGN KEY `FilterCategory_cardId_fkey`;

-- DropForeignKey
ALTER TABLE `filteroption` DROP FOREIGN KEY `FilterOption_filterCategoryId_fkey`;

-- AlterTable
ALTER TABLE `card` DROP PRIMARY KEY,
    DROP COLUMN `cardTitle`,
    DROP COLUMN `dateTimeSelected`,
    DROP COLUMN `price`,
    ADD COLUMN `addressId` INTEGER NOT NULL,
    ADD COLUMN `categoria` VARCHAR(255) NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `horario_preferencial` VARCHAR(255) NOT NULL,
    ADD COLUMN `subcategoria` VARCHAR(255) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `valor` VARCHAR(50) NOT NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- DropTable
DROP TABLE `addresscontent`;

-- DropTable
DROP TABLE `filtercategory`;

-- DropTable
DROP TABLE `filteroption`;

-- CreateTable
CREATE TABLE `Address` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cep` CHAR(8) NOT NULL,
    `street` VARCHAR(255) NOT NULL,
    `neighborhood` VARCHAR(255) NOT NULL,
    `city` VARCHAR(255) NOT NULL,
    `state` CHAR(2) NOT NULL,
    `number` VARCHAR(10) NOT NULL,
    `complement` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Card_addressId_key` ON `Card`(`addressId`);

-- AddForeignKey
ALTER TABLE `Card` ADD CONSTRAINT `Card_addressId_fkey` FOREIGN KEY (`addressId`) REFERENCES `Address`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
