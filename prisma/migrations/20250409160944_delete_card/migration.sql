/*
  Warnings:

  - You are about to drop the `address` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `card` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `card` DROP FOREIGN KEY `Card_addressId_fkey`;

-- DropTable
DROP TABLE `address`;

-- DropTable
DROP TABLE `card`;
