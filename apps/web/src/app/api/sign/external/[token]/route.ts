import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimitChecked } from "@/lib/rate-limit";
import { resolveSigningToken } from "@/lib/signing-links";
import { executeDecline, executeSign, loadTaskForSign, type SignMode } from "@/lib/signing";
import { expireDueTasks, getCurrentSigners } from "@/lib/tasks";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const tokenInclude = {
  signer: {
    include: {
      task: {
        include: {
          signers: { orderBy: { order: "asc" as const }, include: { user: { select: { fullName: true } } } },
          document: {
            include: {
              versions: { orderBy: { version: "desc" as const }, take: 1 },
            },
          },
        },
      },
    },
  },
} as const;

/** Unauthenticated data fetch for external signers. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    await expireDueTasks();
    const tokenRow = await resolveSigningToken(token, { allowUsed: true, include: tokenInclude });
    if (!tokenRow) throw new ApiError(404, "SIGN_LINK_INVALID");

    const signer = tokenRow.signer;
    const task = signer.task;
    const latestVersion = task.document.versions[0];
    const current = getCurrentSigners(task.flowType, task.signers);
    const publicCode = tokenRow.shortCode ?? token;

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
          !tokenRow.usedAt &&
          task.approvalStatus === "APPROVED" &&
          task.signingStatus === "IN_PROGRESS" &&
          signer.status === "PENDING" &&
          current.some((s) => s.id === signer.id),
      },
      fileUrl: latestVersion ? `/api/files/${latestVersion.storageKey}?token=${publicCode}` : null,
      signers: task.signers.map((s) => ({
        signRole: s.signRole,
        status: s.status,
        order: s.order,
        name: s.user?.fullName ?? s.externalFullName ?? null,
      })),
      requiresEmailVerification: true,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

interface ExternalSignBody {
  action?: string;
  mode?: string;
  imageDataUrl?: string;
  comment?: string;
  reason?: string;
  verificationId?: string;
}

/** Unauthenticated signing for external signers — gated by email code verification. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const rl = rateLimitChecked({
      key: `external:sign:${getClientIp(req)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", { retryAfter: rl.retryAfterSeconds });

    await expireDueTasks();
    const body = (await req.json()) as ExternalSignBody;
    const isDecline = body.action === "decline";

    if (!isDecline && body.mode !== "COMPANY_SEAL" && body.mode !== "HANDWRITE") {
      throw new ApiError(400, "SIGNING_METHOD_INVALID");
    }
    if (!body.verificationId) {
      throw new ApiError(400, "EMAIL_VERIFICATION_REQUIRED");
    }

    const tokenRow = await resolveSigningToken(token, { allowUsed: false, include: tokenInclude });
    if (!tokenRow) throw new ApiError(404, "SIGN_LINK_INVALID");

    const verification = await prisma.identityVerification.findUnique({
      where: { id: body.verificationId },
    });
    if (
      !verification ||
      verification.status !== "VERIFIED" ||
      verification.signingTokenId !== tokenRow.id
    ) {
      throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED");
    }

    const signer = tokenRow.signer;
    const taskRow = await prisma.signingTask.findUnique({
      where: { id: signer.taskId },
      include: { signers: true },
    });
    if (!taskRow) throw new ApiError(404, "TASK_NOT_FOUND");

    if (isDecline) {
      await executeDecline({
        task: taskRow,
        signer,
        operatorId: null,
        reason: body.reason ?? body.comment,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
      });
    } else {
      if (body.mode === "COMPANY_SEAL") {
        throw new ApiError(403, "EXTERNAL_SIGN_HANDWRITE_ONLY");
      }

      const task = await loadTaskForSign(signer.taskId);
      if (!task) throw new ApiError(404, "TASK_NOT_FOUND");

      const result = await executeSign({
        task,
        signer,
        operatorId: null,
        mode: body.mode as SignMode,
        imageDataUrl: body.imageDataUrl,
        comment: body.comment,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      await prisma.signingToken.update({
        where: { id: tokenRow.id },
        data: { usedAt: new Date() },
      });

      return NextResponse.json({ ok: true, ...result });
    }

    await prisma.signingToken.update({
      where: { id: tokenRow.id },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
