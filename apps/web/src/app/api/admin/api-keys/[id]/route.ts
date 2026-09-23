import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { actorUserId, requireApiKeyOrSession } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiKeyOrSession(["SUPER_ADMIN"]);
    const { id } = await params;
    const existing = await prisma.apiKey.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "API_KEY_NOT_FOUND");

    // Already revoked → permanently remove from the list
    if (existing.revokedAt) {
      await prisma.apiKey.delete({ where: { id } });
      await recordAudit({
        userId: actorUserId(actor),
        action: "api_key.delete",
        targetType: "api_key",
        targetId: id,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        detail: { name: existing.name, keyPrefix: existing.keyPrefix },
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await recordAudit({
      userId: actorUserId(actor),
      action: "api_key.revoke",
      targetType: "api_key",
      targetId: id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
