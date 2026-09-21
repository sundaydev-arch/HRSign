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
import { getCurrentSigners } from "./tasks";
import { notifyTaskApproved, notifyTaskCompleted } from "@/server/notifications/task-events";
import { getSignatureProvider, getStorage } from "@/server/providers";

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

  const provider = getSignatureProvider(mode === "COMPANY_SEAL" ? "IMAGE_SEAL" : "HANDWRITE");
  const signResult = await provider.sign({
    source: {
      documentId: task.documentId,
      version: latestVersion.version,
      stage: latestVersion.stage,
      storageKey: latestVersion.storageKey,
      sha256: latestVersion.sha256,
    },
    signer: {
      taskId: task.id,
      signerId: signer.id,
      signerRole: signer.signRole,
      operatorId,
      method: mode === "COMPANY_SEAL" ? "IMAGE_SEAL" : "HANDWRITE",
      imageBytes: stampBytes,
      sealId,
      placements: targetFields.map((field) => ({
        fieldId: field.id,
        coordinates: parseFieldCoordinates(field),
      })),
      ip,
      userAgent,
    },
    watermarkText: process.env.WATERMARK_TEXT,
  });

  const { newVersion, signature } = signResult;

  // Persist DB records atomically: version + one Signature row per placement
  // + signer state transition. The PDF file was already written by the provider.
  await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        documentId: task.documentId,
        version: newVersion.version,
        stage: newVersion.stage,
        storageKey: newVersion.storageKey,
        sha256: newVersion.sha256,
        // External signers have no account; attribute the version to the task
        // initiator (the real actor is recorded on Signature/audit).
        createdBy: operatorId ?? task.createdBy,
      },
    }),
    prisma.signature.createMany({
      data: signature.fieldIds.map((fieldId) => ({
        taskId: task.id,
        signerId: signer.id,
        operatorId,
        method: signature.method,
        storageKey: signature.storageKey,
        sealId,
        fieldId,
        ip,
        userAgent,
      })),
    }),
    prisma.signer.update({
      where: { id: signer.id },
      data: { status: "SIGNED", signedAt: new Date() },
    }),
  ]);

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
  } else {
    await notifyTaskApproved(task.id);
  }

  return { completed, version: newVersion.version };
}
