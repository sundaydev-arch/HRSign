import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { actorUserId, requireApiKeyOrSession } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { WebhookEventSchema } from "@/schemas/webhook-payload";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiKeyOrSession(["SUPER_ADMIN"]);
    const { id } = await params;
    const existing = await prisma.webhook.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "WEBHOOK_NOT_FOUND");

    const body = (await req.json()) as {
      name?: string;
      url?: string;
      events?: string[];
      enabled?: boolean;
    };

    const data: {
      name?: string;
      url?: string;
      events?: string[];
      enabled?: boolean;
    } = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) throw new ApiError(400, "WEBHOOK_NAME_REQUIRED");
      data.name = name;
    }
    if (typeof body.url === "string") {
      const url = body.url.trim();
      if (!url || !URL.canParse(url)) throw new ApiError(400, "WEBHOOK_URL_INVALID");
      data.url = url;
    }
    if (Array.isArray(body.events)) {
      for (const e of body.events) {
        if (!WebhookEventSchema.safeParse(e).success) {
          throw new ApiError(400, "WEBHOOK_EVENT_INVALID", { event: e });
        }
      }
      if (body.events.length === 0) throw new ApiError(400, "WEBHOOK_EVENTS_REQUIRED");
      data.events = body.events;
    }
    if (typeof body.enabled === "boolean") data.enabled = body.enabled;

    const row = await prisma.webhook.update({ where: { id }, data });

    await recordAudit({
      userId: actorUserId(actor),
      action: "webhook.update",
      targetType: "webhook",
      targetId: id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: data,
    });

    return NextResponse.json({ webhook: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiKeyOrSession(["SUPER_ADMIN"]);
    const { id } = await params;
    const existing = await prisma.webhook.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "WEBHOOK_NOT_FOUND");

    await prisma.webhook.delete({ where: { id } });

    await recordAudit({
      userId: actorUserId(actor),
      action: "webhook.delete",
      targetType: "webhook",
      targetId: id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
