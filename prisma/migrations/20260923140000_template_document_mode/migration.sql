-- CreateEnum
CREATE TYPE "TemplateEditorMode" AS ENUM ('DOCUMENT', 'PDF_OVERLAY');

-- AlterTable
ALTER TABLE "template_versions" ADD COLUMN "editorMode" "TemplateEditorMode" NOT NULL DEFAULT 'PDF_OVERLAY';
ALTER TABLE "template_versions" ADD COLUMN "contentJson" JSONB;
