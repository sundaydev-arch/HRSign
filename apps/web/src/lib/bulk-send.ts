import { ApiError } from "@/lib/api";
import { createEnvelope, sendEnvelope, toEnvelopeDto } from "@/lib/envelopes";
import { prisma } from "@/lib/prisma";

export type BulkRow = {
  name?: string;
  email: string;
  subject?: string;
  phoneE164?: string;
  idvMethod?: string;
  deliveryChannel?: string;
};

export async function createBulkSendBatch(input: {
  templateId: string;
  rows: BulkRow[];
  createdBy: string;
  emailBlurb?: string;
  send?: boolean;
}) {
  if (!input.templateId.trim()) throw new ApiError(400, "VALIDATION_FAILED");
  if (!input.rows?.length) throw new ApiError(400, "VALIDATION_FAILED");

  const template = await prisma.template.findUnique({
    where: { id: input.templateId },
    include: {
      versions: {
        where: { status: "PUBLISHED" },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });
  if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND");
  const version = template.versions[0];
  const docName = template.name ? `${template.name}.pdf` : "Document.pdf";

  const batch = await prisma.bulkSendBatch.create({
    data: {
      templateId: input.templateId,
      status: "processing",
      total: input.rows.length,
      createdBy: input.createdBy,
    },
  });

  const results: Array<{
    email: string;
    name?: string;
    envelopeId?: string;
    accessUrl?: string | null;
    error?: string;
  }> = [];
  let succeeded = 0;
  let failed = 0;
  const shouldSend = input.send !== false;

  for (const row of input.rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email) {
      failed++;
      results.push({ email: row.email ?? "", name: row.name, error: "EMAIL_REQUIRED" });
      continue;
    }
    try {
      const env = await createEnvelope({
        subject: (row.subject || `${template.name} — ${row.name || email}`).trim(),
        emailBlurb: input.emailBlurb,
        createdBy: input.createdBy,
        documents: [
          {
            name: docName,
            documentOrder: 1,
            storageKey: version?.storageKey,
            pageCount: version?.pageCount ?? 1,
          },
        ],
        recipients: [
          {
            recipientType: "signer",
            routingOrder: 1,
            name: (row.name || email).trim(),
            email,
            phoneE164: row.phoneE164,
            idvMethod: row.idvMethod ?? "none",
            deliveryChannel: row.deliveryChannel ?? "email",
          },
        ],
      });

      let accessUrl: string | null = null;
      if (shouldSend) {
        const { envelope, tokens } = await sendEnvelope(env.id);
        const dto = toEnvelopeDto(envelope, tokens);
        accessUrl = dto.recipients[0]?.accessUrl ?? null;
      }

      succeeded++;
      results.push({ email, name: row.name, envelopeId: env.id, accessUrl });
    } catch (err) {
      failed++;
      const code = err instanceof ApiError ? err.code : "BULK_ROW_FAILED";
      results.push({ email, name: row.name, error: code });
    }
  }

  const status = failed === 0 ? "completed" : succeeded === 0 ? "failed" : "completed";
  const updated = await prisma.bulkSendBatch.update({
    where: { id: batch.id },
    data: { status, succeeded, failed, results },
  });

  return {
    batchId: updated.id,
    templateId: updated.templateId,
    status: updated.status,
    total: updated.total,
    succeeded: updated.succeeded,
    failed: updated.failed,
    results,
    accepted: succeeded,
  };
}

export async function listBulkSendBatches(limit = 50) {
  const rows = await prisma.bulkSendBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(200, limit),
  });
  return rows.map((r) => ({
    batchId: r.id,
    templateId: r.templateId,
    status: r.status,
    total: r.total,
    succeeded: r.succeeded,
    failed: r.failed,
    createdAt: r.createdAt.toISOString(),
  }));
}
