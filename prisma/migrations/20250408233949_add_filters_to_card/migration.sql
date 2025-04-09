/*
  Warnings:

  - You are about to drop the column `complement` on the `addresscontent` table. All the data in the column will be lost.
  - You are about to drop the column `neighborhood` on the `addresscontent` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `card` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `card` table. All the data in the column will be lost.
  - You are about to drop the column `isSingleSelect` on the `filtercategory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `addresscontent` DROP COLUMN `complement`,
    DROP COLUMN `neighborhood`;

-- AlterTable
ALTER TABLE `card` DROP COLUMN `createdAt`,
    DROP COLUMN `updatedAt`;

-- AlterTable
ALTER TABLE `filtercategory` DROP COLUMN `isSingleSelect`;
