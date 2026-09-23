import { createHash } from "node:crypto";
import { ApiError } from "@/lib/api";
import { buildCertificate, getEnvelopeOrThrow, toEnvelopeDto } from "@/lib/envelopes";
import { prisma } from "@/lib/prisma";

/**
 * Evidence pack — DocuSign-style completion evidence as a portable JSON bundle.
 * Not a court-ready LTV archive; includes hashes + CoC + event timeline.
 */
export async function buildEvidencePack(envelopeId: string) {
  const env = await getEnvelopeOrThrow(envelopeId);
  if (env.status !== "completed") throw new ApiError(409, "ENVELOPE_NOT_COMPLETED");

  const events = await prisma.envelopeEvent.findMany({
    where: { envelopeId },
    orderBy: { createdAt: "asc" },
  });
  const coc = await buildCertificate(envelopeId);
  const dto = toEnvelopeDto(env);

  const documents = dto.documents.map((d) => ({
    id: d.id,
    name: d.name,
    documentOrder: d.documentOrder,
    sha256: d.sha256,
    pageCount: d.pageCount,
  }));

  const recipients = dto.recipients.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    recipientType: r.recipientType,
    status: r.status,
    idvMethod: r.idvMethod,
    idvStatus: r.idvStatus,
    signedAt: r.signedAt,
    declinedAt: r.declinedAt,
  }));

  const pack = {
    format: "hrsign.evidence.v1",
    generatedAt: new Date().toISOString(),
    envelope: {
      id: dto.id,
      accountId: dto.accountId,
      subject: dto.subject,
      status: dto.status,
      sentAt: dto.sentAt,
      completedAt: dto.completedAt,
    },
    certificateOfCompletion: coc,
    documents,
    recipients,
    tabs: dto.tabs.map((t) => ({
      id: t.id,
      tabType: t.tabType,
      recipientId: t.recipientId,
      required: t.required,
      value: t.value,
      coordinates: t.coordinates,
    })),
    timeline: events.map((e) => ({
      id: e.id,
      action: e.action,
      actorEmail: e.actorEmail,
      meta: e.meta,
      createdAt: e.createdAt.toISOString(),
    })),
    trust: {
      signatureProviders: ["IMAGE_SEAL", "HANDWRITE", "PADES", "GM_SM2"],
      note: "PADES/GM_SM2 are demo adapters unless a production CA is configured",
    },
  };

  const canonical = JSON.stringify(pack);
  const packSha256 = createHash("sha256").update(canonical).digest("hex");

  return {
    ...pack,
    integrity: { sha256: packSha256, algorithm: "sha256" },
  };
}
