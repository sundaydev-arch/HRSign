-- Phase 2: identity & delivery fields on recipients + SMS/IDV enum values

ALTER TYPE "IdentityVerificationType" ADD VALUE IF NOT EXISTS 'SMS_OTP';
ALTER TYPE "IdentityVerificationType" ADD VALUE IF NOT EXISTS 'KBA';
ALTER TYPE "IdentityVerificationType" ADD VALUE IF NOT EXISTS 'ID_DOCUMENT';

ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'SMS';

ALTER TABLE "envelope_recipients" ADD COLUMN IF NOT EXISTS "phoneE164" TEXT;
ALTER TABLE "envelope_recipients" ADD COLUMN IF NOT EXISTS "deliveryChannel" TEXT NOT NULL DEFAULT 'email';
ALTER TABLE "envelope_recipients" ADD COLUMN IF NOT EXISTS "idvMethod" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "envelope_recipients" ADD COLUMN IF NOT EXISTS "idvStatus" TEXT NOT NULL DEFAULT 'skipped';
ALTER TABLE "envelope_recipients" ADD COLUMN IF NOT EXISTS "hostUserId" TEXT;
ALTER TABLE "envelope_recipients" ADD COLUMN IF NOT EXISTS "witnessForId" TEXT;
