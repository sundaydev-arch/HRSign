import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Toggle legal hold on an archived document. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser(["HR", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = (await req.json()) as {
      legalHold?: boolean;
      legalHoldReason?: string | null;
      legalHoldUntil?: string | null;
    };

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) throw new ApiError(404, "DOCUMENT_NOT_FOUND");

    const legalHold = Boolean(body.legalHold);
    const updated = await prisma.document.update({
      where: { id },
      data: {
        legalHold,
        legalHoldReason: legalHold ? (body.legalHoldReason ?? doc.legalHoldReason) : null,
        legalHoldUntil:
          legalHold && body.legalHoldUntil
            ? new Date(body.legalHoldUntil)
            : legalHold
              ? doc.legalHoldUntil
              : null,
      },
    });

    await recordAudit({
      userId: user.id,
      action: legalHold ? "document.legal_hold.on" : "document.legal_hold.off",
      targetType: "document",
      targetId: id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: {
        reason: updated.legalHoldReason,
        until: updated.legalHoldUntil,
      },
    });

    return NextResponse.json({ document: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
