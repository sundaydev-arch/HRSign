import type {
  Document,
  DocumentVersion,
  Signer,
  SigningTask,
  TemplateField,
  TemplateVersion,
} from "@prisma/client";
import { CoordinatesSchema, type Coordinates } from "@/schemas/coordinates";
import { ApiError } from "./api";
import { recordAudit } from "./audit";
import { prisma } from "./prisma";
import { resolveWatermarkText } from "./watermark-settings";
import { resolveSignatureMethod } from "./app-settings";
import { getCurrentSigners } from "./tasks";
import {
  notifyTaskApproved,
  notifyTaskCompleted,
  notifyTaskDeclined,
} from "@/server/notifications/task-events";
import { assertSigningTransition } from "@/server/state-machines/signing";
import { assertSignerTransition } from "@/server/state-machines/signer";
import { ensureSignatureMethod, getSignatureProvider, getStorage } from "@/server/providers";

export type SignMode = "COMPANY_SEAL" | "HANDWRITE";

export type SignTaskFull = SigningTask & {
  signers: Signer[];
  document: Document & {
    versions: DocumentVersion[];
    templateVersion: TemplateVersion & { fields: TemplateField[] };
  };
};

export interface ExecuteSignInput {
  task: SignTaskFull;
  signer: Signer;
  /** Internal operator userId; null for an external signer. */
  operatorId: string | null;
  mode: SignMode;
  sealId?: string;
  imageDataUrl?: string;
  comment?: string;
  ip: string;
  userAgent: string;
}

const MAX_SIGNATURE_SIZE = 2 * 1024 * 1024;

/** Parse a template field's coordinates Json column (must go through zod, spec 13.2). */
export function parseFieldCoordinates(field: TemplateField): Coordinates {
  return CoordinatesSchema.parse(field.coordinates);
}

/** Load the full signing task aggregate (signers / latest version / template fields). */
export async function loadTaskForSign(taskId: string): Promise<SignTaskFull | null> {
  const task = await prisma.signingTask.findUnique({
    where: { id: taskId },
    include: {
      signers: true,
      document: {
        include: {
          versions: { orderBy: { version: "desc" }, take: 1 },
          templateVersion: { include: { fields: true } },
        },
      },
    },
  });
  return (task as SignTaskFull | null) ?? null;
}

/**
 * Execute the core signing flow (company seal / handwritten signature):
 * state-machine checks → locate placements → provider overlay → DB records
 * in a single transaction → audit → notification.
 *
 * Rules (spec 3.3): signing requires approvalStatus = APPROVED and
 * signingStatus = IN_PROGRESS; this is what enforces approval-before-seal.
 */
export async function executeSign(input: ExecuteSignInput): Promise<{ completed: boolean; version: number }> {
  const { task, signer, operatorId, mode, ip, userAgent } = input;

  if (signer.taskId !== task.id) throw new ApiError(403, "SIGN_LINK_INVALID");
  if (signer.status !== "PENDING") throw new ApiError(400, "TASK_ALREADY_PROCESSED");
  if (task.approvalStatus !== "APPROVED") throw new ApiError(400, "SEAL_REQUIRES_APPROVAL");
  if (task.signingStatus !== "IN_PROGRESS") throw new ApiError(400, "TASK_NOT_SIGNABLE");
  if (!getCurrentSigners(task.flowType, task.signers).some((candidate) => candidate.id === signer.id)) {
    throw new ApiError(403, "NOT_YOUR_TURN");
  }

  if (mode === "COMPANY_SEAL") {
    if (signer.signRole !== "COMPANY_SEAL") throw new ApiError(403, "SEAL_ROLE_REQUIRED");
  } else if (signer.signRole !== "PERSONAL_SIGNATURE") {
    throw new ApiError(403, "SIGNATURE_ROLE_REQUIRED");
  }

  // Load the stamp image: a backend-side seal read, or an uploaded signature.
  let stampBytes: Buffer;
  let sealName: string | null = null;
  let sealId: string | null = null;
  const storage = getStorage();
  if (mode === "COMPANY_SEAL") {
    if (!input.sealId) throw new ApiError(400, "SEAL_REQUIRED");
    const seal = await prisma.seal.findFirst({ where: { id: input.sealId, enabled: true } });
    if (!seal) throw new ApiError(400, "SEAL_NOT_FOUND");
    sealName = seal.name;
    sealId = seal.id;
    stampBytes = await storage.get(seal.storageKey);
  } else {
    const dataUrl = input.imageDataUrl ?? "";
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match || !match[1]) throw new ApiError(400, "SIGNATURE_IMAGE_INVALID");
    stampBytes = Buffer.from(match[1], "base64");
    if (stampBytes.length === 0 || stampBytes.length > MAX_SIGNATURE_SIZE) {
      throw new ApiError(400, "SIGNATURE_IMAGE_TOO_LARGE");
    }
  }

  // Locate the target placements (SEAL fields for a company seal,
  // SIGNATURE fields for a personal signature).
  const fieldType = mode === "COMPANY_SEAL" ? "SEAL" : "SIGNATURE";
  const targetFields = task.document.templateVersion.fields.filter((field) => field.type === fieldType);
  if (targetFields.length === 0) throw new ApiError(400, "SIGNING_FIELD_MISSING");

  const latestVersion = task.document.versions[0];
  if (!latestVersion) throw new ApiError(500, "DOCUMENT_VERSION_MISSING");

  // Claim the next version under a document row lock so parallel signers cannot
  // both derive the same source.version + 1.
  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT id FROM documents WHERE id = $1 FOR UPDATE`,
      task.documentId,
    );
    const freshSigner = await tx.signer.findUnique({ where: { id: signer.id } });
    if (!freshSigner || freshSigner.status !== "PENDING") {
      throw new ApiError(400, "TASK_ALREADY_PROCESSED");
    }
    const tip = await tx.documentVersion.findFirst({
      where: { documentId: task.documentId },
      orderBy: { version: "desc" },
    });
    if (!tip) throw new ApiError(500, "DOCUMENT_VERSION_MISSING");
    return { source: tip, nextVersion: tip.version + 1 };
  });

  const configuredMethod = await resolveSignatureMethod();
  const providerMethod =
    configuredMethod === "IMAGE_SEAL"
      ? mode === "COMPANY_SEAL"
        ? "IMAGE_SEAL"
        : "HANDWRITE"
      : configuredMethod;
  ensureSignatureMethod(providerMethod);
  const provider = getSignatureProvider(providerMethod);
  let signResult;
  try {
    signResult = await provider.sign({
      source: {
        documentId: task.documentId,
        version: claimed.source.version,
        stage: claimed.source.stage,
        storageKey: claimed.source.storageKey,
        sha256: claimed.source.sha256,
      },
      claimedVersion: claimed.nextVersion,
      signer: {
        taskId: task.id,
        signerId: signer.id,
        signerRole: signer.signRole,
        operatorId,
        method: providerMethod,
        imageBytes: stampBytes,
        sealId,
        placements: targetFields.map((field) => ({
          fieldId: field.id,
          coordinates: parseFieldCoordinates(field),
        })),
        ip,
        userAgent,
      },
      watermarkText: await resolveWatermarkText(),
    });
  } catch (err) {
    if (err instanceof Error && /already exists|overwrite/i.test(err.message)) {
      throw new ApiError(409, "DOCUMENT_VERSION_CONFLICT");
    }
    throw err;
  }

  const { newVersion, signature } = signResult;

  // Persist DB records atomically: version + Signature rows + signer transition.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.documentVersion.create({
        data: {
          documentId: task.documentId,
          version: newVersion.version,
          stage: newVersion.stage,
          storageKey: newVersion.storageKey,
          sha256: newVersion.sha256,
          createdBy: operatorId ?? task.createdBy,
        },
      });
      await tx.signature.createMany({
        data: signature.fieldIds.map((fieldId) => ({
          taskId: task.id,
          signerId: signer.id,
          operatorId,
          method: signature.method,
          storageKey: signature.storageKey,
          sealId,
          fieldId,
          verificationResult: signature.verificationResult as object,
          ip,
          userAgent,
        })),
      });
      await tx.signer.update({
        where: { id: signer.id },
        data: { status: "SIGNED", signedAt: new Date() },
      });
    });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code)
        : "";
    if (code === "P2002") throw new ApiError(409, "DOCUMENT_VERSION_CONFLICT");
    throw err;
  }

  const remainingSigners = await prisma.signer.count({
    where: { taskId: task.id, signRole: { not: "APPROVER" }, status: "PENDING" },
  });
  const completed = remainingSigners === 0;
  if (completed) {
    // IN_PROGRESS → COMPLETED (legal signing state-machine transition, spec 3.3).
    await prisma.signingTask.update({
      where: { id: task.id },
      data: { signingStatus: "COMPLETED" },
    });
  }

  await recordAudit({
    userId: operatorId,
    action: "task.sign",
    targetType: "task",
    targetId: task.id,
    ip,
    userAgent,
    documentSha256: newVersion.sha256,
    detail: {
      mode,
      sealName,
      signerId: signer.id,
      version: newVersion.version,
      external: !operatorId,
    },
  });

  if (completed) {
    await notifyTaskCompleted(task.id);
    await import("@/server/webhooks/dispatch").then(({ dispatchWebhookEvent }) =>
      dispatchWebhookEvent("signing.completed", {
        taskId: task.id,
        documentId: task.documentId,
      }),
    );
  } else {
    await notifyTaskApproved(task.id);
  }

  return { completed, version: newVersion.version };
}

export type DeclineTaskInput = {
  task: SigningTask & { signers: Signer[] };
  signer: Signer;
  /** Internal operator userId; null for an external signer. */
  operatorId: string | null;
  reason?: string | null;
  ip: string;
  userAgent: string;
};

/**
 * Personal signer declines to sign: signer PENDING → DECLINED, task IN_PROGRESS → DECLINED.
 */
export async function executeDecline(input: DeclineTaskInput): Promise<void> {
  const { task, signer, operatorId, ip, userAgent } = input;
  const reason = input.reason?.trim() || null;

  if (signer.taskId !== task.id) throw new ApiError(403, "SIGN_LINK_INVALID");
  if (signer.signRole !== "PERSONAL_SIGNATURE") throw new ApiError(403, "SIGNATURE_ROLE_REQUIRED");
  if (signer.status !== "PENDING") throw new ApiError(400, "TASK_ALREADY_PROCESSED");
  if (task.approvalStatus !== "APPROVED") throw new ApiError(400, "TASK_NOT_SIGNABLE");
  if (task.signingStatus !== "IN_PROGRESS") throw new ApiError(400, "TASK_NOT_SIGNABLE");
  if (!getCurrentSigners(task.flowType, task.signers).some((candidate) => candidate.id === signer.id)) {
    throw new ApiError(403, "NOT_YOUR_TURN");
  }

  assertSignerTransition(signer.status, "DECLINED");
  assertSigningTransition(task.signingStatus, "DECLINED");

  await prisma.$transaction([
    prisma.signer.update({
      where: { id: signer.id },
      data: { status: "DECLINED", declinedAt: new Date(), declinedReason: reason },
    }),
    prisma.signingTask.update({
      where: { id: task.id },
      data: { signingStatus: "DECLINED" },
    }),
  ]);

  await recordAudit({
    userId: operatorId,
    action: "task.decline",
    targetType: "task",
    targetId: task.id,
    ip,
    userAgent,
    detail: { signerId: signer.id, reason, external: !operatorId },
  });

  await notifyTaskDeclined(task.id, reason);
  await import("@/server/webhooks/dispatch").then(({ dispatchWebhookEvent }) =>
    dispatchWebhookEvent("signing.declined", {
      taskId: task.id,
      data: { reason, signerId: signer.id },
    }),
  );
}
