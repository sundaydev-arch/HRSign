-- CreateEnum
CREATE TYPE "EnvelopeStatus" AS ENUM ('created', 'sent', 'delivered', 'signed', 'completed', 'declined', 'voided', 'expired', 'corrected');
CREATE TYPE "RecipientType" AS ENUM ('signer', 'cc', 'agent', 'editor', 'certifiedDelivery', 'inPersonSigner', 'notary', 'witness', 'carbonCopy', 'intermediary');
CREATE TYPE "EnvelopeRecipientStatus" AS ENUM ('created', 'sent', 'delivered', 'signed', 'declined', 'completed', 'faxpending', 'autoresponded');
CREATE TYPE "TabType" AS ENUM ('signHere', 'initialHere', 'dateSigned', 'text', 'fullName', 'emailAddress', 'checkbox', 'radioGroup', 'formula', 'attachment', 'payment', 'company', 'title', 'note');

CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "accounts_slug_key" ON "accounts"("slug");

CREATE TABLE "account_members" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'sender',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "account_members_accountId_userId_key" ON "account_members"("accountId", "userId");

CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#1a1a1a',
    "logoKey" TEXT,
    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "envelopes" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "status" "EnvelopeStatus" NOT NULL DEFAULT 'created',
    "subject" TEXT NOT NULL,
    "emailBlurb" TEXT,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "legacyTaskId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "envelopes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "envelopes_legacyTaskId_key" ON "envelopes"("legacyTaskId");
CREATE INDEX "envelopes_status_idx" ON "envelopes"("status");
CREATE INDEX "envelopes_createdBy_idx" ON "envelopes"("createdBy");
CREATE INDEX "envelopes_accountId_idx" ON "envelopes"("accountId");

CREATE TABLE "envelope_documents" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "documentOrder" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "storageKey" TEXT,
    "sha256" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "envelope_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "envelope_documents_envelopeId_idx" ON "envelope_documents"("envelopeId");

CREATE TABLE "envelope_recipients" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "recipientType" "RecipientType" NOT NULL DEFAULT 'signer',
    "routingOrder" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "EnvelopeRecipientStatus" NOT NULL DEFAULT 'created',
    "userId" TEXT,
    "accessTokenHash" TEXT,
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "envelope_recipients_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "envelope_recipients_envelopeId_idx" ON "envelope_recipients"("envelopeId");
CREATE INDEX "envelope_recipients_email_idx" ON "envelope_recipients"("email");

CREATE TABLE "envelope_tabs" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "envelopeDocumentId" TEXT,
    "recipientId" TEXT,
    "tabType" "TabType" NOT NULL,
    "coordinates" JSONB NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "value" TEXT,
    "conditional" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "envelope_tabs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "envelope_tabs_envelopeId_idx" ON "envelope_tabs"("envelopeId");
CREATE INDEX "envelope_tabs_recipientId_idx" ON "envelope_tabs"("recipientId");

CREATE TABLE "envelope_comments" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "documentId" TEXT,
    "page" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "envelope_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "envelope_comments_envelopeId_idx" ON "envelope_comments"("envelopeId");

CREATE TABLE "envelope_events" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorEmail" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "envelope_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "envelope_events_envelopeId_idx" ON "envelope_events"("envelopeId");

CREATE TABLE "power_forms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "urlSlug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "power_forms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "power_forms_urlSlug_key" ON "power_forms"("urlSlug");

CREATE TABLE "clickwraps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "bodyHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clickwraps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clm_agreements" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clm_agreements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notary_transactions" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notary_transactions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "account_members" ADD CONSTRAINT "account_members_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brands" ADD CONSTRAINT "brands_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "envelopes" ADD CONSTRAINT "envelopes_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "envelopes" ADD CONSTRAINT "envelopes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "envelope_documents" ADD CONSTRAINT "envelope_documents_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "envelope_recipients" ADD CONSTRAINT "envelope_recipients_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "envelope_tabs" ADD CONSTRAINT "envelope_tabs_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "envelope_tabs" ADD CONSTRAINT "envelope_tabs_envelopeDocumentId_fkey" FOREIGN KEY ("envelopeDocumentId") REFERENCES "envelope_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "envelope_tabs" ADD CONSTRAINT "envelope_tabs_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "envelope_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "envelope_comments" ADD CONSTRAINT "envelope_comments_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "envelope_comments" ADD CONSTRAINT "envelope_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "envelope_events" ADD CONSTRAINT "envelope_events_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
