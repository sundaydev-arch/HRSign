import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { FILLABLE_TYPES, fillTemplate } from "@/lib/pdf/fill";
import { prisma } from "@/lib/prisma";
import { isManagerRole, requireApiUser } from "@/lib/rbac";
import { expireDueTasks, getCurrentSigners } from "@/lib/tasks";
import { CoordinatesSchema } from "@/schemas/coordinates";
import { notifyTaskCreated } from "@/server/notifications/task-events";
import { getStorage } from "@/server/providers";
import type { SignerRole, SigningFlowType } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";

export const runtime = "nodejs";

const SIGNER_ROLES: SignerRole[] = ["APPROVER", "COMPANY_SEAL", "PERSONAL_SIGNATURE"];

interface CreateSignerInput {
  signRole: string;
  userId?: string;
  externalFullName?: string;
  externalEmail?: string;
}

interface CreateTaskBody {
  templateId?: string;
  title?: string;
  flowType?: string;
  expiresAt?: string;
  formValues?: Record<string, string>;
  signers?: CreateSignerInput[];
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireApiUser();
    await expireDueTasks();
    const tab = req.nextUrl.searchParams.get("tab") ?? "all";

    const include = {
      document: { select: { category: true } },
      creator: { select: { fullName: true } },
      signers: { select: { id: true, userId: true, signRole: true, status: true, order: true } },
    } as const;

    let tasks;
    if (tab === "pending-approve") {
      const rows = await prisma.signingTask.findMany({
        where: {
          approvalStatus: "PENDING",
          signers: { some: { userId: user.id, signRole: "APPROVER", status: "PENDING" } },
        },
        include,
        orderBy: { createdAt: "desc" },
      });
      tasks = rows.filter((t) => getCurrentSigners(t.flowType, t.signers).some((s) => s.userId === user.id));
    } else if (tab === "pending-sign") {
      const rows = await prisma.signingTask.findMany({
        where: {
          signingStatus: "IN_PROGRESS",
          signers: { some: { userId: user.id, signRole: { not: "APPROVER" }, status: "PENDING" } },
        },
        include,
        orderBy: { createdAt: "desc" },
      });
      tasks = rows.filter((t) => getCurrentSigners(t.flowType, t.signers).some((s) => s.userId === user.id));
    } else if (tab === "mine") {
      tasks = await prisma.signingTask.findMany({
        where: { createdBy: user.id },
        include,
        orderBy: { createdAt: "desc" },
      });
    } else if (isManagerRole(user.role)) {
      tasks = await prisma.signingTask.findMany({ include, orderBy: { createdAt: "desc" } });
    } else {
      tasks = await prisma.signingTask.findMany({
        where: {
          OR: [
            { createdBy: user.id },
            { signers: { some: { userId: user.id } } },
          ],
        },
        include,
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        approvalStatus: t.approvalStatus,
        signingStatus: t.signingStatus,
        flowType: t.flowType,
        category: t.document.category,
        creatorName: t.creator.fullName,
        signerCount: t.signers.length,
        expiresAt: t.expiresAt,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
    const body = (await req.json()) as CreateTaskBody;

    if (!body.templateId) throw new ApiError(400, "TEMPLATE_REQUIRED");
    const title = (body.title ?? "").trim();
    if (!title) throw new ApiError(400, "TASK_TITLE_REQUIRED");
    if (body.flowType !== "SEQUENTIAL" && body.flowType !== "PARALLEL") {
      throw new ApiError(400, "SIGNING_METHOD_INVALID");
    }
    const expiresAt = new Date(body.expiresAt ?? "");
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new ApiError(400, "EXPIRY_MUST_BE_FUTURE");
    }
    if (!Array.isArray(body.signers) || body.signers.length === 0) {
      throw new ApiError(400, "SIGNERS_REQUIRED");
    }
    const flowType = body.flowType as SigningFlowType;
    const formValues = body.formValues ?? {};

    // spec 3.1: the Document references templateVersionId; take the latest
    // published version of the template.
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

    // Validate and normalize signers. External signers also get a plaintext
    // token used only in the email link; only the token hash is stored.
    const normalizedSigners = body.signers.map((s, index): {
      userId: string | null;
      externalFullName: string | null;
      externalEmail: string | null;
      plainToken: string | null;
      signRole: SignerRole;
      order: number;
    } => {
      const order = index + 1;
      if (!SIGNER_ROLES.includes(s.signRole as SignerRole)) {
        throw new ApiError(400, "SIGNER_ROLE_INVALID", { index: order });
      }
      const signRole = s.signRole as SignerRole;
      if (s.userId) {
        return { userId: s.userId, externalFullName: null, externalEmail: null, plainToken: null, signRole, order };
      }
      const externalFullName = (s.externalFullName ?? "").trim();
      const externalEmail = (s.externalEmail ?? "").trim().toLowerCase();
      if (!externalFullName || !externalEmail) {
        throw new ApiError(400, "SIGNER_INFO_INCOMPLETE", { index: order });
      }
      return {
        userId: null,
        externalFullName,
        externalEmail,
        plainToken: randomUUID(),
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

    // Signing fields must match signer roles (field types: SEAL = company seal
    // field, SIGNATURE = personal signature field).
    const sealFields = version.fields.filter((f) => f.type === "SEAL");
    const signFields = version.fields.filter((f) => f.type === "SIGNATURE");
    if (sealFields.length > 0 && !normalizedSigners.some((s) => s.signRole === "COMPANY_SEAL")) {
      throw new ApiError(400, "COMPANY_SEAL_SIGNER_REQUIRED");
    }
    if (signFields.length > 0 && !normalizedSigners.some((s) => s.signRole === "PERSONAL_SIGNATURE")) {
      throw new ApiError(400, "PERSONAL_SIGNER_REQUIRED");
    }

    // Required form-field validation (spec 3.1: fillable types are TEXT / DATE).
    for (const f of version.fields) {
      if (FILLABLE_TYPES.includes(f.type) && f.required) {
        const v = formValues[f.id];
        if (v == null || String(v).trim() === "") {
          throw new ApiError(400, "REQUIRED_FIELD_MISSING", { label: f.label });
        }
      }
    }

    // PDF fill engine (runs entirely on the backend; the template source is
    // never modified). The coordinates Json column is always unpacked through
    // the zod schema (spec 13.2).
    const templateBytes = await getStorage().get(version.storageKey);
    const filledBytes = await fillTemplate({
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

    const docId = randomUUID();
    // spec 2: the storage key carries the version and stage; overwriting is forbidden.
    const storageKey = `documents/${docId}/v1-FILLED.pdf`;
    await getStorage().put({ key: storageKey, data: filledBytes, contentType: "application/pdf" });
    const filledSha256 = createHash("sha256").update(filledBytes).digest("hex");

    // spec 3.3: when there are approvers the task enters approval first
    // (NOT_STARTED); otherwise it goes straight into signing.
    const hasApprovers = normalizedSigners.some((s) => s.signRole === "APPROVER");

    const issuedIp = getClientIp(req);
    const issuedUserAgent = getUserAgent(req);
    const externalTokenMap = new Map<string, string>();

    const task = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          id: docId,
          templateVersionId: version.id,
          title,
          category: template.category,
          createdBy: user.id,
        },
      });
      await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          version: 1,
          stage: "FILLED",
          storageKey,
          sha256: filledSha256,
          createdBy: user.id,
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
          createdBy: user.id,
        },
      });
      // signer.createMany does not return ids, but each SigningToken needs its
      // signerId linked individually, so create signers in a loop.
      for (const s of normalizedSigners) {
        const signer = await tx.signer.create({
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
        if (s.plainToken) {
          await tx.signingToken.create({
            data: {
              signerId: signer.id,
              tokenHash: createHash("sha256").update(s.plainToken).digest("hex"),
              expiresAt,
              issuedIp,
              issuedUserAgent,
            },
          });
          externalTokenMap.set(signer.id, s.plainToken);
        }
      }
      return t;
    });

    await recordAudit({
      userId: user.id,
      action: "task.create",
      targetType: "task",
      targetId: task.id,
      ip: issuedIp,
      userAgent: issuedUserAgent,
      detail: { title, templateVersionId: version.id, flowType, signerCount: normalizedSigners.length },
    });
    // The external-signer notification needs the plaintext token to build the
    // one-time link (only the hash is stored).
    await notifyTaskCreated(task.id, externalTokenMap);

    return NextResponse.json({ taskId: task.id, documentId: docId });
  } catch (err) {
    return handleApiError(err);
  }
}
