import { createHash, randomBytes } from "node:crypto";
import type {
  Envelope,
  EnvelopeDocument,
  EnvelopeRecipient,
  EnvelopeStatus,
  EnvelopeTab,
  RecipientType,
  TabType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

const ENVELOPE_TRANSITIONS: Record<string, EnvelopeStatus[]> = {
  created: ["sent", "voided"],
  sent: ["delivered", "signed", "completed", "declined", "voided", "expired", "corrected"],
  delivered: ["signed", "completed", "declined", "voided", "expired", "corrected"],
  signed: ["completed"],
  corrected: ["sent"],
  completed: [],
  declined: [],
  voided: [],
  expired: [],
};

export function assertEnvelopeTransition(from: EnvelopeStatus, to: EnvelopeStatus) {
  const allowed = ENVELOPE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ApiError(409, "ENVELOPE_INVALID_STATE", { from, to });
  }
}

const AUTO_COMPLETE: RecipientType[] = ["cc", "carbonCopy", "certifiedDelivery"];

export type EnvelopeDto = {
  id: string;
  accountId: string | null;
  status: EnvelopeStatus;
  subject: string;
  emailBlurb: string | null;
  sentAt: string | null;
  completedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  expiresAt: string | null;
  legacyTaskId: string | null;
  documents: Array<{
    id: string;
    name: string;
    documentOrder: number;
    storageKey: string | null;
    sha256: string | null;
    pageCount: number;
    fileUrl: string | null;
  }>;
  recipients: Array<{
    id: string;
    recipientType: RecipientType;
    routingOrder: number;
    name: string;
    email: string;
    phoneE164: string | null;
    deliveryChannel: string;
    idvMethod: string;
    idvStatus: string;
    hostUserId: string | null;
    witnessForId: string | null;
    status: string;
    userId: string | null;
    signedAt: string | null;
    declinedAt: string | null;
    declineReason: string | null;
    accessUrl: string | null;
  }>;
  tabs: Array<{
    id: string;
    tabType: TabType;
    envelopeDocumentId: string | null;
    recipientId: string | null;
    coordinates: unknown;
    required: boolean;
    value: string | null;
    conditional: unknown;
  }>;
  createdAt: string;
  updatedAt: string;
};

type EnvelopeFull = Envelope & {
  documents: EnvelopeDocument[];
  recipients: EnvelopeRecipient[];
  tabs: EnvelopeTab[];
};

export function toEnvelopeDto(env: EnvelopeFull, tokens?: Map<string, string>): EnvelopeDto {
  return {
    id: env.id,
    accountId: env.accountId,
    status: env.status,
    subject: env.subject,
    emailBlurb: env.emailBlurb,
    sentAt: env.sentAt?.toISOString() ?? null,
    completedAt: env.completedAt?.toISOString() ?? null,
    voidedAt: env.voidedAt?.toISOString() ?? null,
    voidReason: env.voidReason,
    expiresAt: env.expiresAt?.toISOString() ?? null,
    legacyTaskId: env.legacyTaskId,
    documents: env.documents
      .slice()
      .sort((a, b) => a.documentOrder - b.documentOrder)
      .map((d) => ({
        id: d.id,
        name: d.name,
        documentOrder: d.documentOrder,
        storageKey: d.storageKey,
        sha256: d.sha256,
        pageCount: d.pageCount,
        fileUrl: d.storageKey ? `/api/files/${d.storageKey}` : null,
      })),
    recipients: env.recipients
      .slice()
      .sort((a, b) => a.routingOrder - b.routingOrder)
      .map((r) => ({
        id: r.id,
        recipientType: r.recipientType,
        routingOrder: r.routingOrder,
        name: r.name,
        email: r.email,
        phoneE164: r.phoneE164,
        deliveryChannel: r.deliveryChannel,
        idvMethod: r.idvMethod,
        idvStatus: r.idvStatus,
        hostUserId: r.hostUserId,
        witnessForId: r.witnessForId,
        status: r.status,
        userId: r.userId,
        signedAt: r.signedAt?.toISOString() ?? null,
        declinedAt: r.declinedAt?.toISOString() ?? null,
        declineReason: r.declineReason,
        accessUrl: tokens?.get(r.id) ?? null,
      })),
    tabs: (env.tabs ?? []).map((t) => ({
      id: t.id,
      tabType: t.tabType,
      envelopeDocumentId: t.envelopeDocumentId,
      recipientId: t.recipientId,
      coordinates: t.coordinates,
      required: t.required,
      value: t.value,
      conditional: t.conditional,
    })),
    createdAt: env.createdAt.toISOString(),
    updatedAt: env.updatedAt.toISOString(),
  };
}

const includeAll = {
  documents: true,
  recipients: true,
  tabs: true,
} as const;

export async function getEnvelopeOrThrow(id: string) {
  const env = await prisma.envelope.findUnique({ where: { id }, include: includeAll });
  if (!env) throw new ApiError(404, "ENVELOPE_NOT_FOUND");
  return env;
}

export async function createEnvelope(input: {
  subject: string;
  emailBlurb?: string;
  expiresAt?: string;
  createdBy: string;
  accountId?: string;
  documents?: Array<{ name: string; documentOrder?: number; storageKey?: string; pageCount?: number }>;
  recipients?: Array<{
    recipientType: RecipientType;
    routingOrder: number;
    name: string;
    email: string;
    userId?: string;
    phoneE164?: string;
    deliveryChannel?: string;
    idvMethod?: string;
    hostUserId?: string;
    witnessForId?: string;
  }>;
}) {
  const docs =
    input.documents && input.documents.length > 0
      ? input.documents
      : [{ name: "Document 1", documentOrder: 1, pageCount: 1 }];

  let accountId = input.accountId ?? null;
  if (!accountId) {
    const { ensureDefaultAccount } = await import("@/lib/accounts");
    const acct = await ensureDefaultAccount(input.createdBy);
    accountId = acct.id;
  }

  const env = await prisma.envelope.create({
    data: {
      subject: input.subject.trim(),
      emailBlurb: input.emailBlurb?.trim() || null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdBy: input.createdBy,
      accountId,
      documents: {
        create: docs.map((d, i) => ({
          name: d.name,
          documentOrder: d.documentOrder ?? i + 1,
          storageKey: d.storageKey ?? null,
          pageCount: d.pageCount ?? 1,
        })),
      },
      recipients: input.recipients?.length
        ? {
            create: input.recipients.map((r) => {
              const idvMethod = r.idvMethod ?? "none";
              return {
                recipientType: r.recipientType,
                routingOrder: r.routingOrder,
                name: r.name,
                email: r.email.toLowerCase(),
                userId: r.userId ?? null,
                phoneE164: r.phoneE164?.trim() || null,
                deliveryChannel: r.deliveryChannel ?? "email",
                idvMethod,
                idvStatus: idvMethod !== "none" ? "pending" : "skipped",
                hostUserId: r.hostUserId ?? null,
                witnessForId: r.witnessForId ?? null,
                status: AUTO_COMPLETE.includes(r.recipientType) ? "completed" : "created",
              };
            }),
          }
        : undefined,
      events: { create: { action: "created", actorEmail: null } },
    },
    include: includeAll,
  });
  return env;
}

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function sendEnvelope(envelopeId: string) {
  const env = await getEnvelopeOrThrow(envelopeId);
  assertEnvelopeTransition(env.status, "sent");
  if (env.recipients.length === 0) {
    throw new ApiError(400, "ENVELOPE_NO_RECIPIENTS");
  }
  if (env.documents.length === 0) {
    throw new ApiError(400, "ENVELOPE_NO_DOCUMENTS");
  }

  const tokens = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    for (const r of env.recipients) {
      if (AUTO_COMPLETE.includes(r.recipientType)) {
        await tx.envelopeRecipient.update({
          where: { id: r.id },
          data: { status: "completed" },
        });
        continue;
      }
      const raw = randomBytes(24).toString("base64url");
      tokens.set(r.id, `/sign/envelope/${envelopeId}?r=${r.id}&t=${raw}`);
      await tx.envelopeRecipient.update({
        where: { id: r.id },
        data: { status: "sent", accessTokenHash: hashToken(raw) },
      });
    }
    await tx.envelope.update({
      where: { id: envelopeId },
      data: { status: "sent", sentAt: new Date() },
    });
    await tx.envelopeEvent.create({
      data: { envelopeId, action: "sent" },
    });
  });

  await ensureDefaultSignTabs(envelopeId);
  const withTabs = await getEnvelopeOrThrow(envelopeId);

  const appBase =
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const dto = toEnvelopeDto(withTabs, tokens);
  const { deliverEnvelopeInvites } = await import("@/lib/envelope-delivery");
  void deliverEnvelopeInvites({
    envelopeId,
    subject: dto.subject,
    emailBlurb: dto.emailBlurb,
    appBaseUrl: appBase,
    recipients: dto.recipients.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phoneE164: r.phoneE164,
      deliveryChannel: r.deliveryChannel,
      recipientType: r.recipientType,
      accessUrl: r.accessUrl,
    })),
  });

  void import("@/server/webhooks/dispatch").then(({ dispatchWebhookEvent }) =>
    dispatchWebhookEvent("envelope.sent", {
      data: { envelopeId, subject: dto.subject },
    }),
  );

  return { envelope: withTabs, tokens };
}

export async function voidEnvelope(envelopeId: string, reason: string) {
  const env = await getEnvelopeOrThrow(envelopeId);
  assertEnvelopeTransition(env.status, "voided");
  const updated = await prisma.envelope.update({
    where: { id: envelopeId },
    data: {
      status: "voided",
      voidedAt: new Date(),
      voidReason: reason.trim(),
      events: { create: { action: "voided", meta: { reason } } },
    },
    include: includeAll,
  });
  void import("@/server/webhooks/dispatch").then(({ dispatchWebhookEvent }) =>
    dispatchWebhookEvent("envelope.voided", {
      data: { envelopeId, reason: reason.trim() },
    }),
  );
  return updated;
}

export async function signAsRecipient(
  envelopeId: string,
  recipientId: string,
  opts?: { tabValues?: Record<string, string>; signatureImageBase64?: string },
) {
  const env = await getEnvelopeOrThrow(envelopeId);
  if (env.status !== "sent" && env.status !== "delivered" && env.status !== "signed") {
    throw new ApiError(409, "ENVELOPE_INVALID_STATE");
  }
  const recipient = env.recipients.find((r) => r.id === recipientId);
  if (!recipient) throw new ApiError(404, "RECIPIENT_NOT_FOUND");
  if (AUTO_COMPLETE.includes(recipient.recipientType)) {
    throw new ApiError(400, "RECIPIENT_CC_NO_SIGN");
  }
  if (recipient.status === "signed" || recipient.status === "completed") {
    throw new ApiError(409, "RECIPIENT_ALREADY_SIGNED");
  }
  if (recipient.idvMethod !== "none" && recipient.idvStatus !== "verified") {
    throw new ApiError(403, "IDV_REQUIRED");
  }

  await prisma.$transaction(async (tx) => {
    await tx.envelopeRecipient.update({
      where: { id: recipientId },
      data: { status: "signed", signedAt: new Date() },
    });
    if (opts?.tabValues) {
      for (const [tabId, value] of Object.entries(opts.tabValues)) {
        await tx.envelopeTab.updateMany({
          where: { id: tabId, envelopeId, recipientId },
          data: { value },
        });
      }
    }
    await tx.envelopeEvent.create({
      data: {
        envelopeId,
        action: "recipient_signed",
        actorEmail: recipient.email,
        meta: { recipientId, hasSignature: Boolean(opts?.signatureImageBase64) },
      },
    });

    const remaining = await tx.envelopeRecipient.count({
      where: {
        envelopeId,
        recipientType: { in: ["signer", "inPersonSigner", "notary", "witness", "editor"] },
        status: { notIn: ["signed", "completed", "declined"] },
      },
    });
    if (remaining === 0) {
      await tx.envelope.update({
        where: { id: envelopeId },
        data: { status: "completed", completedAt: new Date() },
      });
      await tx.envelopeEvent.create({ data: { envelopeId, action: "completed" } });
    } else if (env.status === "sent") {
      await tx.envelope.update({
        where: { id: envelopeId },
        data: { status: "delivered" },
      });
    } else {
      await tx.envelope.update({
        where: { id: envelopeId },
        data: { status: "signed" },
      });
    }
  });

  void import("@/server/webhooks/dispatch").then(({ dispatchWebhookEvent }) =>
    dispatchWebhookEvent("recipient.completed", {
      data: { envelopeId, recipientId },
    }),
  );

  const next = await getEnvelopeOrThrow(envelopeId);
  if (next.status === "completed") {
    void import("@/server/webhooks/dispatch").then(({ dispatchWebhookEvent }) =>
      dispatchWebhookEvent("envelope.completed", {
        data: { envelopeId },
      }),
    );
  }
  return next;
}

export async function buildCertificate(envelopeId: string) {
  const env = await getEnvelopeOrThrow(envelopeId);
  if (env.status !== "completed") {
    throw new ApiError(409, "ENVELOPE_NOT_COMPLETED");
  }
  return {
    envelopeId: env.id,
    status: env.status,
    subject: env.subject,
    completedAt: env.completedAt!.toISOString(),
    recipients: env.recipients.map((r) => ({
      name: r.name,
      email: r.email,
      recipientType: r.recipientType,
      status: r.status,
      signedAt: r.signedAt?.toISOString() ?? null,
    })),
    documents: env.documents.map((d) => ({
      name: d.name,
      sha256: d.sha256,
    })),
  };
}

export const TAB_TYPES = [
  "signHere",
  "initialHere",
  "dateSigned",
  "text",
  "fullName",
  "emailAddress",
  "checkbox",
  "radioGroup",
  "formula",
  "attachment",
  "payment",
  "company",
  "title",
  "note",
] as const;

export const IDV_METHODS = ["email_otp", "sms_otp", "kba", "id_document", "face"] as const;

export type TabInput = {
  tabType: TabType;
  envelopeDocumentId?: string;
  recipientId?: string;
  coordinates?: { page: number; x: number; y: number; width: number; height: number };
  required?: boolean;
  value?: string;
  conditional?: unknown;
};

export async function replaceEnvelopeTabs(envelopeId: string, tabs: TabInput[]) {
  const env = await getEnvelopeOrThrow(envelopeId);
  if (env.status !== "created") throw new ApiError(409, "ENVELOPE_INVALID_STATE");
  const docIds = new Set(env.documents.map((d) => d.id));
  const recIds = new Set(env.recipients.map((r) => r.id));

  await prisma.$transaction(async (tx) => {
    await tx.envelopeTab.deleteMany({ where: { envelopeId } });
    if (tabs.length === 0) return;
    await tx.envelopeTab.createMany({
      data: tabs.map((t) => {
        if (t.envelopeDocumentId && !docIds.has(t.envelopeDocumentId)) {
          throw new ApiError(400, "VALIDATION_FAILED");
        }
        if (t.recipientId && !recIds.has(t.recipientId)) {
          throw new ApiError(400, "VALIDATION_FAILED");
        }
        return {
          envelopeId,
          tabType: t.tabType,
          envelopeDocumentId: t.envelopeDocumentId ?? env.documents[0]?.id ?? null,
          recipientId: t.recipientId ?? null,
          coordinates: t.coordinates ?? { page: 1, x: 72, y: 72, width: 160, height: 40 },
          required: t.required ?? true,
          value: t.value ?? null,
          conditional: t.conditional ?? undefined,
        };
      }),
    });
  });
  return getEnvelopeOrThrow(envelopeId);
}

/** After send: seed one signHere tab per signer on first document if none exist. */
export async function ensureDefaultSignTabs(envelopeId: string) {
  const env = await getEnvelopeOrThrow(envelopeId);
  if (env.tabs.length > 0) return env;
  const doc = env.documents[0];
  if (!doc) return env;
  const signers = env.recipients.filter((r) => !AUTO_COMPLETE.includes(r.recipientType));
  if (signers.length === 0) return env;
  await prisma.envelopeTab.createMany({
    data: signers.map((r, i) => ({
      envelopeId,
      envelopeDocumentId: doc.id,
      recipientId: r.id,
      tabType: "signHere" as TabType,
      coordinates: { page: 1, x: 72, y: 120 + i * 60, width: 160, height: 48 },
      required: true,
    })),
  });
  return getEnvelopeOrThrow(envelopeId);
}

export async function assertRecipientToken(
  envelopeId: string,
  recipientId: string,
  rawToken: string,
) {
  const env = await getEnvelopeOrThrow(envelopeId);
  const recipient = env.recipients.find((r) => r.id === recipientId);
  if (!recipient) throw new ApiError(401, "SIGN_LINK_INVALID");

  // Prefer access-token hash (email / refreshed embed link)
  if (recipient.accessTokenHash) {
    const hash = hashToken(rawToken);
    if (hash === recipient.accessTokenHash) {
      return { envelope: env, recipient };
    }
  }

  // Embedded HMAC JWT-style token (envelopeId.recipientId.exp.sig)
  try {
    const { verifyEmbedToken } = await import("@/lib/embedded-view");
    const claims = verifyEmbedToken(rawToken);
    if (claims.envelopeId === envelopeId && claims.recipientId === recipientId) {
      return { envelope: env, recipient };
    }
  } catch {
    // fall through
  }

  throw new ApiError(401, "SIGN_LINK_INVALID");
}

export async function markRecipientViewed(envelopeId: string, recipientId: string) {
  const env = await getEnvelopeOrThrow(envelopeId);
  const recipient = env.recipients.find((r) => r.id === recipientId);
  if (!recipient) throw new ApiError(404, "RECIPIENT_NOT_FOUND");
  if (recipient.status === "sent") {
    await prisma.envelopeRecipient.update({
      where: { id: recipientId },
      data: { status: "delivered" },
    });
    if (env.status === "sent") {
      await prisma.envelope.update({
        where: { id: envelopeId },
        data: { status: "delivered" },
      });
    }
    await prisma.envelopeEvent.create({
      data: {
        envelopeId,
        action: "recipient_viewed",
        actorEmail: recipient.email,
        meta: { recipientId },
      },
    });
  }
  return getEnvelopeOrThrow(envelopeId);
}
