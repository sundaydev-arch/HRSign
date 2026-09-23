import { createHash } from "node:crypto";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export function toClickwrapDto(
  row: {
    id: string;
    name: string;
    displayName: string | null;
    status: string;
    bodyHtml: string | null;
    version: number;
    requireScroll: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count?: { acceptances: number };
  },
  opts?: { includeBody?: boolean },
) {
  return {
    clickwrapId: row.id,
    name: row.name,
    displayName: row.displayName ?? row.name,
    status: row.status,
    version: row.version,
    requireScroll: row.requireScroll,
    bodyHtml: opts?.includeBody === false ? undefined : row.bodyHtml,
    acceptanceCount: row._count?.acceptances ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createClickwrap(input: {
  name: string;
  displayName?: string;
  bodyHtml?: string;
  requireScroll?: boolean;
  status?: string;
}) {
  if (!input.name.trim()) throw new ApiError(400, "VALIDATION_FAILED");
  return prisma.clickwrap.create({
    data: {
      name: input.name.trim(),
      displayName: input.displayName?.trim() || null,
      bodyHtml: input.bodyHtml ?? "<p>I agree to the terms.</p>",
      requireScroll: input.requireScroll ?? false,
      status: input.status ?? "active",
    },
  });
}

export async function acceptClickwrap(input: {
  clickwrapId: string;
  acceptorEmail: string;
  acceptorName?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const cw = await prisma.clickwrap.findUnique({ where: { id: input.clickwrapId } });
  if (!cw || cw.status !== "active") throw new ApiError(404, "CLICKWRAP_NOT_FOUND");
  if (!input.acceptorEmail.trim()) throw new ApiError(400, "VALIDATION_FAILED");

  const documentHash = createHash("sha256")
    .update(`${cw.id}:${cw.version}:${cw.bodyHtml ?? ""}`)
    .digest("hex");

  const acceptance = await prisma.clickwrapAcceptance.create({
    data: {
      clickwrapId: cw.id,
      acceptorEmail: input.acceptorEmail.trim().toLowerCase(),
      acceptorName: input.acceptorName?.trim() || null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      documentHash,
    },
  });

  return {
    acceptanceId: acceptance.id,
    clickwrapId: cw.id,
    version: cw.version,
    documentHash,
    acceptedAt: acceptance.acceptedAt.toISOString(),
  };
}

export function toRoomDto(row: {
  id: string;
  name: string;
  status: string;
  description: string | null;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  members?: Array<{ id: string; name: string; email: string; role: string }>;
  documents?: Array<{ id: string; name: string; storageKey: string | null; envelopeId: string | null }>;
}) {
  return {
    roomId: row.id,
    name: row.name,
    status: row.status,
    description: row.description,
    ownerId: row.ownerId,
    members: row.members?.map((m) => ({
      memberId: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
    })),
    documents: row.documents?.map((d) => ({
      documentId: d.id,
      name: d.name,
      storageKey: d.storageKey,
      envelopeId: d.envelopeId,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toClmDto(row: {
  id: string;
  name: string;
  status: string;
  counterparty: string | null;
  envelopeId: string | null;
  effectiveOn: Date | null;
  expiresOn: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    agreementId: row.id,
    name: row.name,
    status: row.status,
    counterparty: row.counterparty,
    envelopeId: row.envelopeId,
    effectiveOn: row.effectiveOn?.toISOString() ?? null,
    expiresOn: row.expiresOn?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toNotaryDto(row: {
  id: string;
  status: string;
  envelopeId: string | null;
  notaryName: string | null;
  jurisdiction: string | null;
  scheduledAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    transactionId: row.id,
    status: row.status,
    envelopeId: row.envelopeId,
    notaryName: row.notaryName,
    jurisdiction: row.jurisdiction,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
