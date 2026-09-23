-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leaderUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TemplateCategory",
    "departmentId" TEXT,
    "approverUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "departmentId" TEXT;

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "signatureMethod" TEXT NOT NULL DEFAULT 'IMAGE_SEAL';
ALTER TABLE "app_settings" ADD COLUMN "remindDaysBefore" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "app_settings" ADD COLUMN "notifyChannels" TEXT NOT NULL DEFAULT '["EMAIL"]';
ALTER TABLE "app_settings" ADD COLUMN "padesCertPem" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "padesKeyPem" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "sm2KeyJson" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");

-- CreateIndex
CREATE INDEX "approval_policies_category_idx" ON "approval_policies"("category");

-- CreateIndex
CREATE INDEX "approval_policies_departmentId_idx" ON "approval_policies"("departmentId");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_leaderUserId_fkey" FOREIGN KEY ("leaderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
