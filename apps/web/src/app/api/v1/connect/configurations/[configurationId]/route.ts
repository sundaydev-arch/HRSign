import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { actorUserId, requireApiKeyOrSession } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ configurationId: string }> },
) {
  try {
    await requireApiKeyOrSession(["SUPER_ADMIN"]);
    const { configurationId } = await ctx.params;
    const row = await prisma.webhook.findUnique({ where: { id: configurationId } });
    if (!row) throw new ApiError(404, "WEBHOOK_NOT_FOUND");
    return NextResponse.json({
      configurationId: row.id,
      name: row.name,
      url: row.url,
      events: row.events,
      enabled: row.enabled,
      secretPrefix: row.secretPrefix,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ configurationId: string }> },
) {
  try {
    const actor = await requireApiKeyOrSession(["SUPER_ADMIN"]);
    const { configurationId } = await ctx.params;
    const existing = await prisma.webhook.findUnique({ where: { id: configurationId } });
    if (!existing) throw new ApiError(404, "WEBHOOK_NOT_FOUND");
    await prisma.webhook.delete({ where: { id: configurationId } });
    await recordAudit({
      userId: actorUserId(actor),
      action: "connect.delete",
      targetType: "webhook",
      targetId: configurationId,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
