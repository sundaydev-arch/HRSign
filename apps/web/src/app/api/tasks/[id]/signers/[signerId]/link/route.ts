import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { getActiveSigningUrl, issueSigningShortLink } from "@/lib/signing-links";
import { resendSignerNotification } from "@/server/notifications/task-events";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Copy / regenerate / resend external signing link for a participant. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; signerId: string }> },
) {
  const { id: taskId, signerId } = await params;
  try {
    const user = await requireApiUser();
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = body.action ?? "link";

    const task = await prisma.signingTask.findUnique({
      where: { id: taskId },
      include: { signers: true },
    });
    if (!task) throw new ApiError(404, "TASK_NOT_FOUND");

    const canManage =
      user.role === "SUPER_ADMIN" ||
      user.role === "HR" ||
      task.createdBy === user.id;
    if (!canManage) throw new ApiError(403, "FORBIDDEN");

    const signer = task.signers.find((s) => s.id === signerId);
    if (!signer?.externalEmail) throw new ApiError(400, "SIGNER_INFO_INCOMPLETE", { index: 0 });

    if (action === "regenerate") {
      const issued = await issueSigningShortLink({
        signerId: signer.id,
        expiresAt: task.expiresAt,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        revokePrevious: true,
      });
      await recordAudit({
        userId: user.id,
        action: "signer.link.regenerate",
        targetType: "signer",
        targetId: signer.id,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        detail: { taskId },
      });
      return NextResponse.json({ url: issued.url, shortCode: issued.shortCode });
    }

    if (action === "resend") {
      let url = await getActiveSigningUrl(signer.id);
      if (!url) {
        const issued = await issueSigningShortLink({
          signerId: signer.id,
          expiresAt: task.expiresAt,
          ip: getClientIp(req),
          userAgent: getUserAgent(req),
        });
        url = issued.url;
      }
      await resendSignerNotification(taskId, signerId);
      await recordAudit({
        userId: user.id,
        action: "signer.link.resend",
        targetType: "signer",
        targetId: signer.id,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        detail: { taskId },
      });
      return NextResponse.json({ ok: true, url });
    }

    // Default: return current link (create if missing)
    let url = await getActiveSigningUrl(signer.id);
    let shortCode: string | null = null;
    if (!url) {
      const issued = await issueSigningShortLink({
        signerId: signer.id,
        expiresAt: task.expiresAt,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
      });
      url = issued.url;
      shortCode = issued.shortCode;
    } else {
      shortCode = url.split("/").pop() ?? null;
    }
    return NextResponse.json({ url, shortCode });
  } catch (err) {
    return handleApiError(err);
  }
}
