-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'HR', 'DEPT_LEADER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "UserLocale" AS ENUM ('zh_CN', 'en');

-- CreateEnum
CREATE TYPE "UserTimeFormat" AS ENUM ('H12', 'H24');

-- CreateEnum
CREATE TYPE "UserWeekStart" AS ENUM ('SUNDAY', 'MONDAY');

-- CreateEnum
CREATE TYPE "UserDensity" AS ENUM ('COMPACT', 'COMFORTABLE');

-- CreateEnum
CREATE TYPE "UserTheme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('OFFER', 'ENTRY', 'CONTRACT', 'RESIGN', 'CERTIFICATE');

-- CreateEnum
CREATE TYPE "TemplateLocale" AS ENUM ('zh_CN', 'en', 'BILINGUAL');

-- CreateEnum
CREATE TYPE "TemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'DATE', 'SEAL', 'SIGNATURE', 'PERFORATION_SEAL');

-- CreateEnum
CREATE TYPE "SealStyle" AS ENUM ('ROUND_CHINESE', 'TEXT_INTERNATIONAL', 'NONE');

-- CreateEnum
CREATE TYPE "DocumentVersionStage" AS ENUM ('FILLED', 'WATERMARKED', 'SEALED', 'SIGNED');

-- CreateEnum
CREATE TYPE "SigningFlowType" AS ENUM ('SEQUENTIAL', 'PARALLEL');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SigningStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SignerStatus" AS ENUM ('PENDING', 'VIEWED', 'SIGNED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SignerRole" AS ENUM ('APPROVER', 'COMPANY_SEAL', 'PERSONAL_SIGNATURE');

-- CreateEnum
CREATE TYPE "SignatureMethod" AS ENUM ('IMAGE_SEAL', 'HANDWRITE', 'PADES', 'GM_SM2');

-- CreateEnum
CREATE TYPE "RetentionAction" AS ENUM ('SOFT_DELETE', 'HARD_DELETE', 'NOTIFY_OWNER');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WECOM', 'DINGTALK', 'LARK');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "IdentityVerificationType" AS ENUM ('EMAIL_CODE', 'FACE', 'REAL_NAME');

-- CreateEnum
CREATE TYPE "IdentityVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "givenName" TEXT,
    "familyName" TEXT,
    "legalNameLatin" TEXT,
    "passwordHash" TEXT,
    "oidcSubject" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locale" "UserLocale" NOT NULL DEFAULT 'zh_CN',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "timeFormat" "UserTimeFormat" NOT NULL DEFAULT 'H24',
    "weekStart" "UserWeekStart" NOT NULL DEFAULT 'MONDAY',
    "density" "UserDensity" NOT NULL DEFAULT 'COMFORTABLE',
    "theme" "UserTheme" NOT NULL DEFAULT 'SYSTEM',
    "phoneE164" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleName" "UserRole" NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL,
    "locale" "TemplateLocale" NOT NULL DEFAULT 'zh_CN',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_versions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "watermarkConfig" JSONB,
    "createdBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_fields" (
    "id" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "label" TEXT NOT NULL,
    "coordinates" JSONB NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "validationRules" JSONB,
    "fontSize" INTEGER NOT NULL DEFAULT 12,
    "fontFamily" TEXT,
    "labelI18n" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" "SealStyle" NOT NULL DEFAULT 'ROUND_CHINESE',
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL,
    "fieldValues" JSONB,
    "createdBy" TEXT NOT NULL,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "legalHoldReason" TEXT,
    "legalHoldUntil" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "stage" "DocumentVersionStage" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signing_tasks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "flowType" "SigningFlowType" NOT NULL DEFAULT 'SEQUENTIAL',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "signingStatus" "SigningStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "expiresAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signing_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signers" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT,
    "externalFullName" TEXT,
    "externalEmail" TEXT,
    "externalPhoneE164" TEXT,
    "signRole" "SignerRole" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "status" "SignerStatus" NOT NULL DEFAULT 'PENDING',
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declinedReason" TEXT,

    CONSTRAINT "signers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signing_tokens" (
    "id" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "issuedIp" TEXT,
    "issuedUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signing_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flows" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "approverIds" TEXT[],
    "currentApproverIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_records" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "ApprovalStatus" NOT NULL,
    "toStatus" "ApprovalStatus" NOT NULL,
    "comment" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "operatorId" TEXT,
    "method" "SignatureMethod" NOT NULL,
    "storageKey" TEXT,
    "sealId" TEXT,
    "fieldId" TEXT,
    "documentVersionId" TEXT,
    "verificationResult" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "result" TEXT NOT NULL DEFAULT 'success',
    "documentSha256" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL,
    "retentionYears" INTEGER NOT NULL,
    "action" "RetentionAction" NOT NULL DEFAULT 'SOFT_DELETE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rateLimitPerMinute" INTEGER,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "secretPrefix" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "taskId" TEXT,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseError" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "recipientUserId" TEXT,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "templateKey" TEXT NOT NULL,
    "templateParams" JSONB,
    "subject" TEXT,
    "body" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "locale" "UserLocale" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "defaultParams" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_verifications" (
    "id" TEXT NOT NULL,
    "type" "IdentityVerificationType" NOT NULL DEFAULT 'EMAIL_CODE',
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "signingTokenId" TEXT,
    "status" "IdentityVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "requestIp" TEXT,
    "requestUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_oidcSubject_key" ON "users"("oidcSubject");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_resource_key" ON "permissions"("action", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleName_permissionId_key" ON "role_permissions"("roleName", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "template_versions_storageKey_key" ON "template_versions"("storageKey");

-- CreateIndex
CREATE INDEX "template_versions_templateId_idx" ON "template_versions"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "template_versions_templateId_version_key" ON "template_versions"("templateId", "version");

-- CreateIndex
CREATE INDEX "template_fields_templateVersionId_idx" ON "template_fields"("templateVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "seals_storageKey_key" ON "seals"("storageKey");

-- CreateIndex
CREATE INDEX "documents_templateVersionId_idx" ON "documents"("templateVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_storageKey_key" ON "document_versions"("storageKey");

-- CreateIndex
CREATE INDEX "document_versions_documentId_idx" ON "document_versions"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_documentId_version_key" ON "document_versions"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "signing_tasks_documentId_key" ON "signing_tasks"("documentId");

-- CreateIndex
CREATE INDEX "signing_tasks_approvalStatus_idx" ON "signing_tasks"("approvalStatus");

-- CreateIndex
CREATE INDEX "signing_tasks_signingStatus_idx" ON "signing_tasks"("signingStatus");

-- CreateIndex
CREATE INDEX "signers_taskId_idx" ON "signers"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "signing_tokens_tokenHash_key" ON "signing_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "signing_tokens_signerId_idx" ON "signing_tokens"("signerId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_flows_taskId_key" ON "approval_flows"("taskId");

-- CreateIndex
CREATE INDEX "approval_records_taskId_idx" ON "approval_records"("taskId");

-- CreateIndex
CREATE INDEX "signatures_taskId_idx" ON "signatures"("taskId");

-- CreateIndex
CREATE INDEX "signatures_signerId_idx" ON "signatures"("signerId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_hash_key" ON "audit_logs"("hash");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "retention_policies_category_key" ON "retention_policies"("category");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhookId_idx" ON "webhook_deliveries"("webhookId");

-- CreateIndex
CREATE INDEX "notification_logs_taskId_idx" ON "notification_logs"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_key_channel_locale_key" ON "notification_templates"("key", "channel", "locale");

-- CreateIndex
CREATE INDEX "identity_verifications_target_idx" ON "identity_verifications"("target");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_fields" ADD CONSTRAINT "template_fields_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seals" ADD CONSTRAINT "seals_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_tasks" ADD CONSTRAINT "signing_tasks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_tasks" ADD CONSTRAINT "signing_tasks_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signers" ADD CONSTRAINT "signers_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "signing_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signers" ADD CONSTRAINT "signers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_tokens" ADD CONSTRAINT "signing_tokens_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "signers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "signing_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "signing_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "signing_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "signers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_sealId_fkey" FOREIGN KEY ("sealId") REFERENCES "seals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "template_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "signing_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "signing_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

