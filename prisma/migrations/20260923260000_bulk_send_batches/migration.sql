CREATE TABLE IF NOT EXISTS "bulk_send_batches" (
  "id" TEXT PRIMARY KEY,
  "templateId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "total" INTEGER NOT NULL DEFAULT 0,
  "succeeded" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT NOT NULL,
  "results" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "bulk_send_batches_createdBy_idx" ON "bulk_send_batches"("createdBy");
