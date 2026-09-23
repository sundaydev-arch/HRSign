-- Shared Envelope DDL for Python / Go migrators (mirrors Prisma).
-- Next.js uses prisma migrate; keep this file in sync after schema changes.

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_members (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'sender',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("accountId", "userId")
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  "brandName" TEXT NOT NULL,
  "primaryColor" TEXT NOT NULL DEFAULT '#1a1a1a',
  "logoKey" TEXT
);

CREATE TYPE "EnvelopeStatus" AS ENUM (
  'created','sent','delivered','signed','completed','declined','voided','expired','corrected'
);
CREATE TYPE "RecipientType" AS ENUM (
  'signer','cc','agent','editor','certifiedDelivery','inPersonSigner','notary','witness','carbonCopy','intermediary'
);
CREATE TYPE "EnvelopeRecipientStatus" AS ENUM (
  'created','sent','delivered','signed','declined','completed','faxpending','autoresponded'
);
CREATE TYPE "TabType" AS ENUM (
  'signHere','initialHere','dateSigned','text','fullName','emailAddress','checkbox','radioGroup',
  'formula','attachment','payment','company','title','note'
);

CREATE TABLE IF NOT EXISTS envelopes (
  id TEXT PRIMARY KEY,
  "accountId" TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  status "EnvelopeStatus" NOT NULL DEFAULT 'created',
  subject TEXT NOT NULL,
  "emailBlurb" TEXT,
  "sentAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "voidedAt" TIMESTAMPTZ,
  "voidReason" TEXT,
  "expiresAt" TIMESTAMPTZ,
  "legacyTaskId" TEXT UNIQUE,
  "createdBy" TEXT NOT NULL REFERENCES users(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS envelopes_status_idx ON envelopes(status);
CREATE INDEX IF NOT EXISTS envelopes_created_by_idx ON envelopes("createdBy");

CREATE TABLE IF NOT EXISTS envelope_documents (
  id TEXT PRIMARY KEY,
  "envelopeId" TEXT NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  "documentOrder" INT NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  "storageKey" TEXT,
  sha256 TEXT,
  "pageCount" INT NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS envelope_recipients (
  id TEXT PRIMARY KEY,
  "envelopeId" TEXT NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  "recipientType" "RecipientType" NOT NULL DEFAULT 'signer',
  "routingOrder" INT NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  "phoneE164" TEXT,
  "deliveryChannel" TEXT NOT NULL DEFAULT 'email',
  "idvMethod" TEXT NOT NULL DEFAULT 'none',
  "idvStatus" TEXT NOT NULL DEFAULT 'skipped',
  "hostUserId" TEXT,
  "witnessForId" TEXT,
  status "EnvelopeRecipientStatus" NOT NULL DEFAULT 'created',
  "userId" TEXT,
  "accessTokenHash" TEXT,
  "signedAt" TIMESTAMPTZ,
  "declinedAt" TIMESTAMPTZ,
  "declineReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS envelope_tabs (
  id TEXT PRIMARY KEY,
  "envelopeId" TEXT NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  "envelopeDocumentId" TEXT REFERENCES envelope_documents(id) ON DELETE CASCADE,
  "recipientId" TEXT REFERENCES envelope_recipients(id) ON DELETE SET NULL,
  "tabType" "TabType" NOT NULL,
  coordinates JSONB NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  value TEXT,
  conditional JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS envelope_comments (
  id TEXT PRIMARY KEY,
  "envelopeId" TEXT NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  "authorId" TEXT REFERENCES users(id) ON DELETE SET NULL,
  "authorName" TEXT NOT NULL,
  body TEXT NOT NULL,
  "documentId" TEXT,
  page INT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS envelope_events (
  id TEXT PRIMARY KEY,
  "envelopeId" TEXT NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  "actorEmail" TEXT,
  meta JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS power_forms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "urlSlug" TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clickwraps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  "bodyHtml" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clm_agreements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notary_transactions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'created',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
