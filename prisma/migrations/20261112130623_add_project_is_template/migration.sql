-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "projects_isTemplate_idx" ON "projects"("isTemplate");
