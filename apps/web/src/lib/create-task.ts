import { ApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { FILLABLE_TYPES, fillTemplate } from "@/lib/pdf/fill";
import { prisma } from "@/lib/prisma";
import { issueSigningShortLink } from "@/lib/signing-links";
import { CoordinatesSchema } from "@/schemas/coordinates";
import {
  CreateTaskBodySchema,
  type CreateTaskBodyParsed,
} from "@/schemas/create-task";
import { notifyTaskCreated } from "@/server/notifications/task-events";
import { getStorage } from "@/server/providers";
import { dispatchWebhookEvent } from "@/server/webhooks/dispatch";
import { enqueueJob } from "@/server/jobs/queue";
import type { SignerRole, SigningFlowType } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

export type CreateSignerInput = {
  signRole: string;
  userId?: string;
  externalFullName?: string;
  externalEmail?: string;
};

export type CreateTaskBody = {
  templateId?: string;
  title?: string;
  flowType?: string;
  expiresAt?: string;
  formValues?: Record<string, string>;
  signers?: CreateSignerInput[];
};

export async function createSigningTask(opts: {
  body: CreateTaskBody;
  userId: string;
  ip: string;
  userAgent: string;
}): Promise<{ taskId: string; documentId: string }> {
  const { userId } = opts;
  const parsed = CreateTaskBodySchema.safeParse(opts.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const msg = issue?.message;
    if (msg === "SIGNER_INFO_INCOMPLETE") {
      throw new ApiError(400, "SIGNER_INFO_INCOMPLETE", { index: 1 });
    }
    if (issue?.path[0] === "templateId") throw new ApiError(400, "TEMPLATE_REQUIRED");
    if (issue?.path[0] === "title") throw new ApiError(400, "TASK_TITLE_REQUIRED");
    if (issue?.path[0] === "flowType") throw new ApiError(400, "SIGNING_METHOD_INVALID");
    if (issue?.path[0] === "expiresAt") throw new ApiError(400, "EXPIRY_MUST_BE_FUTURE");
    if (issue?.path[0] === "signers") throw new ApiError(400, "SIGNERS_REQUIRED");
    throw new ApiError(400, "VALIDATION_FAILED");
  }
  const body: CreateTaskBodyParsed = parsed.data;

  const expiresAt = new Date(body.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new ApiError(400, "EXPIRY_MUST_BE_FUTURE");
  }
  const flowType = body.flowType as SigningFlowType;
  const formValues = body.formValues ?? {};
  const title = body.title;

  const template = await prisma.template.findUnique({
    where: { id: body.templateId },
    include: {
      versions: {
        where: { status: "PUBLISHED" },
        orderBy: { version: "desc" },
        take: 1,
        include: { fields: true },
      },
    },
  });
  const version = template?.versions[0];
  if (!template || !version) {
    throw new ApiError(400, "TEMPLATE_NOT_PUBLISHED");
  }

  const normalizedSigners = body.signers.map((s, index) => {
    const order = index + 1;
    const signRole = s.signRole as SignerRole;
    if (s.userId) {
      return {
        userId: s.userId,
        externalFullName: null as string | null,
        externalEmail: null as string | null,
        needsExternalToken: false,
        signRole,
        order,
      };
    }
    return {
      userId: null as string | null,
      externalFullName: (s.externalFullName ?? "").trim(),
      externalEmail: (s.externalEmail ?? "").trim().toLowerCase(),
      needsExternalToken: true,
      signRole,
      order,
    };
  });

  for (const s of normalizedSigners) {
    if (s.userId) {
      const u = await prisma.user.findUnique({ where: { id: s.userId } });
      if (!u || !u.isActive) {
        throw new ApiError(400, "SIGNER_ACCOUNT_INVALID", { index: s.order });
      }
    }
  }

  // Auto-inject APPROVER signers from ApprovalPolicy when none provided
  if (!normalizedSigners.some((s) => s.signRole === "APPROVER")) {
    const creator = await prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    const policy = await prisma.approvalPolicy.findFirst({
      where: {
        enabled: true,
        OR: [
          { category: template.category, departmentId: creator?.departmentId ?? undefined },
          { category: template.category, departmentId: null },
          { category: null, departmentId: creator?.departmentId ?? undefined },
          { category: null, departmentId: null },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
    if (policy && policy.approverUserIds.length > 0) {
      let order = 0;
      for (const uid of policy.approverUserIds) {
        const u = await prisma.user.findUnique({ where: { id: uid } });
        if (!u?.isActive) continue;
        order += 1;
        normalizedSigners.unshift({
          userId: uid,
          externalFullName: null,
          externalEmail: null,
          needsExternalToken: false,
          signRole: "APPROVER",
          order,
        });
      }
      // Re-number all signers
      normalizedSigners.forEach((s, i) => {
        s.order = i + 1;
      });
    }
  }

  const sealFields = version.fields.filter((f) => f.type === "SEAL");
  const signFields = version.fields.filter((f) => f.type === "SIGNATURE");
  if (sealFields.length > 0 && !normalizedSigners.some((s) => s.signRole === "COMPANY_SEAL")) {
    throw new ApiError(400, "COMPANY_SEAL_SIGNER_REQUIRED");
  }
  if (signFields.length > 0 && !normalizedSigners.some((s) => s.signRole === "PERSONAL_SIGNATURE")) {
    throw new ApiError(400, "PERSONAL_SIGNER_REQUIRED");
  }

  for (const f of version.fields) {
    if (FILLABLE_TYPES.includes(f.type) && f.required) {
      const v = formValues[f.id];
      if (v == null || String(v).trim() === "") {
        throw new ApiError(400, "REQUIRED_FIELD_MISSING", { label: f.label });
      }
    }
  }

  // Prefer async PDF fill when worker is up; fall back to sync.
  const templateBytes = await getStorage().get(version.storageKey);
  let filledBytes: Uint8Array;
  try {
    filledBytes = await fillTemplate({
      templateBytes,
      fields: version.fields.map((f) => {
        const c = CoordinatesSchema.parse(f.coordinates);
        return {
          id: f.id,
          type: f.type,
          label: f.label,
          page: c.page,
          x: c.x,
          y: c.y,
          width: c.width,
          height: c.height,
          fontSize: f.fontSize,
          placeholder: f.defaultValue,
        };
      }),
      values: formValues,
    });
  } catch (err) {
    throw err;
  }

  const docId = randomUUID();
  const storageKey = `documents/${docId}/v1-FILLED.pdf`;
  await getStorage().put({ key: storageKey, data: Buffer.from(filledBytes), contentType: "application/pdf" });
  const filledSha256 = createHash("sha256").update(filledBytes).digest("hex");

  const hasApprovers = normalizedSigners.some((s) => s.signRole === "APPROVER");

  const task = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        id: docId,
        templateVersionId: version.id,
        title,
        category: template.category,
        createdBy: userId,
      },
    });
    await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        version: 1,
        stage: "FILLED",
        storageKey,
        sha256: filledSha256,
        createdBy: userId,
      },
    });
    const t = await tx.signingTask.create({
      data: {
        documentId: doc.id,
        title,
        flowType,
        approvalStatus: hasApprovers ? "PENDING" : "APPROVED",
        signingStatus: hasApprovers ? "NOT_STARTED" : "IN_PROGRESS",
        expiresAt,
        createdBy: userId,
      },
    });
    for (const s of normalizedSigners) {
      await tx.signer.create({
        data: {
          taskId: t.id,
          userId: s.userId,
          externalFullName: s.externalFullName,
          externalEmail: s.externalEmail,
          signRole: s.signRole,
          order: s.order,
          status: "PENDING",
        },
      });
    }
    return t;
  });

  // Issue short links outside the main tx (retries on collision).
  const externalSigners = await prisma.signer.findMany({
    where: { taskId: task.id, externalEmail: { not: null } },
  });
  for (const signer of externalSigners) {
    await issueSigningShortLink({
      signerId: signer.id,
      expiresAt,
      ip: opts.ip,
      userAgent: opts.userAgent,
    });
  }

  await recordAudit({
    userId,
    action: "task.create",
    targetType: "task",
    targetId: task.id,
    ip: opts.ip,
    userAgent: opts.userAgent,
    detail: { title, templateVersionId: version.id, flowType, signerCount: normalizedSigners.length },
  });

  try {
    await notifyTaskCreated(task.id);
  } catch (err) {
    console.error("[create-task] notify failed", err);
    await enqueueJob("notify.task_created", { taskId: task.id }).catch(() => undefined);
  }

  await dispatchWebhookEvent("task.created", {
    taskId: task.id,
    documentId: docId,
    data: { title, flowType },
  }).catch((err) => console.error("[create-task] webhook failed", err));

  return { taskId: task.id, documentId: docId };
}
