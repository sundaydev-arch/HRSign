-- Phase 3: Clickwrap / Rooms / CLM / Notary enrichment

ALTER TABLE "clickwraps" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "clickwraps" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "clickwraps" ADD COLUMN IF NOT EXISTS "requireScroll" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS "clickwrap_acceptances" (
  "id" TEXT PRIMARY KEY,
  "clickwrapId" TEXT NOT NULL REFERENCES "clickwraps"("id") ON DELETE CASCADE,
  "acceptorName" TEXT,
  "acceptorEmail" TEXT NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "documentHash" TEXT,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "clickwrap_acceptances_clickwrapId_idx" ON "clickwrap_acceptances"("clickwrapId");
CREATE INDEX IF NOT EXISTS "clickwrap_acceptances_acceptorEmail_idx" ON "clickwrap_acceptances"("acceptorEmail");

ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

CREATE TABLE IF NOT EXISTS "room_members" (
  "id" TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'viewer',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "room_members_roomId_idx" ON "room_members"("roomId");

CREATE TABLE IF NOT EXISTS "room_documents" (
  "id" TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "storageKey" TEXT,
  "envelopeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "room_documents_roomId_idx" ON "room_documents"("roomId");

ALTER TABLE "clm_agreements" ADD COLUMN IF NOT EXISTS "counterparty" TEXT;
ALTER TABLE "clm_agreements" ADD COLUMN IF NOT EXISTS "envelopeId" TEXT;
ALTER TABLE "clm_agreements" ADD COLUMN IF NOT EXISTS "effectiveOn" TIMESTAMP(3);
ALTER TABLE "clm_agreements" ADD COLUMN IF NOT EXISTS "expiresOn" TIMESTAMP(3);
ALTER TABLE "clm_agreements" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "notary_transactions" ADD COLUMN IF NOT EXISTS "envelopeId" TEXT;
ALTER TABLE "notary_transactions" ADD COLUMN IF NOT EXISTS "notaryName" TEXT;
ALTER TABLE "notary_transactions" ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT;
ALTER TABLE "notary_transactions" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "notary_transactions" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "notary_transactions" ADD COLUMN IF NOT EXISTS "notes" TEXT;
