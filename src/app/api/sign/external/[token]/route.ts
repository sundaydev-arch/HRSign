import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { executeSign, loadTaskForSign } from "@/lib/signing";
import { expireDueTasks, getCurrentSigners } from "@/lib/tasks";
import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

/** Resolve SigningToken + Signer from the plaintext token in the link (only its hash is stored, spec 4). */
async function resolveToken(plaintext: string) {
  const tokenHash = createHash("sha256").update(plaintext).digest("hex");
  const tokenRow = await prisma.signingToken.findUnique({
    where: { tokenHash },
    include: {
      signer: {
        include: {
          task: {
            include: {
              signers: { orderBy: { order: "asc" }, include: { user: { select: { fullName: true } } } },
              document: {
                include: {
                  versions: { orderBy: { version: "desc" }, take: 1 },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!tokenRow || tokenRow.revokedAt || tokenRow.usedAt || tokenRow.expiresAt <= new Date()) {
    throw new ApiError(404, "SIGN_LINK_INVALID");
  }
  return tokenRow;
}

/** Unauthenticated data fetch for external signers: read-only task data and signing eligibility via token. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    await expireDueTasks();
    const tokenRow = await resolveToken(token);
    const signer = tokenRow.signer;
    const task = signer.task;
    const latestVersion = task.document.versions[0];
    const current = getCurrentSigners(task.flowType, task.signers);

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        approvalStatus: task.approvalStatus,
        signingStatus: task.signingStatus,
        flowType: task.flowType,
        expiresAt: task.expiresAt,
      },
      me: {
        name: signer.externalFullName,
        email: signer.externalEmail,
        signRole: signer.signRole,
        status: signer.status,
        canSign:
          task.approvalStatus === "APPROVED" &&
          task.signingStatus === "IN_PROGRESS" &&
          signer.status === "PENDING" &&
          current.some((s) => s.id === signer.id),
      },
      fileUrl: latestVersion ? `/api/files/${latestVersion.storageKey}?token=${token}` : null,
      signers: task.signers.map((s) => ({
        signRole: s.signRole,
        status: s.status,
        order: s.order,
        name: s.user?.fullName ?? s.externalFullName ?? null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

interface ExternalSignBody {
  mode?: string; // COMPANY_SEAL | HANDWRITE
  imageDataUrl?: string;
  comment?: string;
}

/** Unauthenticated signing for external signers: apply a handwritten signature directly with the token. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    await expireDueTasks();
    const body = (await req.json()) as ExternalSignBody;
    if (body.mode !== "COMPANY_SEAL" && body.mode !== "HANDWRITE") {
      throw new ApiError(400, "SIGNING_METHOD_INVALID");
    }

    const tokenRow = await resolveToken(token);
    const signer = tokenRow.signer;
    if (body.mode === "COMPANY_SEAL") {
      throw new ApiError(403, "EXTERNAL_SIGN_HANDWRITE_ONLY");
    }

    const task = await loadTaskForSign(signer.taskId);
    if (!task) throw new ApiError(404, "TASK_NOT_FOUND");

    const result = await executeSign({
      task,
      signer,
      operatorId: null,
      mode: body.mode,
      imageDataUrl: body.imageDataUrl,
      comment: body.comment,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    // spec 4: invalidate the token once signing is complete.
    await prisma.signingToken.update({
      where: { id: tokenRow.id },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
