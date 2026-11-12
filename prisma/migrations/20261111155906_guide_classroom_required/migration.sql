/*
  Warnings:

  - Made the column `classroomId` on table `guides` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "guides" ALTER COLUMN "classroomId" SET NOT NULL;
