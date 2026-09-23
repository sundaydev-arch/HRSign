import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { actorUserId, requireApiKeyOrSession } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { WebhookEventSchema } from "@/schemas/webhook-payload";
import { prepareWebhookSecret } from "@/server/webhooks/dispatch";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireApiKeyOrSession(["SUPER_ADMIN"]);
    const webhooks = await prisma.webhook.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        url: true,
        secretPrefix: true,
        events: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { deliveries: true } },
        deliveries: {
          where: { status: "FAILED" },
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { id: true, responseError: true, responseStatus: true, createdAt: true },
        },
      },
    });
    const failedCounts = await prisma.webhookDelivery.groupBy({
      by: ["webhookId"],
      where: { status: "FAILED", webhookId: { in: webhooks.map((w) => w.id) } },
      _count: true,
    });
    const failedById = new Map(failedCounts.map((f) => [f.webhookId, f._count]));
    return NextResponse.json({
      webhooks: webhooks.map(({ deliveries, ...w }) => ({
        ...w,
        failedDeliveries: failedById.get(w.id) ?? 0,
        lastFailure: deliveries[0]
          ? {
              error: deliveries[0].responseError,
              status: deliveries[0].responseStatus,
              at: deliveries[0].createdAt,
            }
          : null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiKeyOrSession(["SUPER_ADMIN"]);
    const body = (await req.json()) as {
      name?: string;
      url?: string;
      events?: string[];
    };
    const name = (body.name ?? "").trim();
    const url = (body.url ?? "").trim();
    if (!name) throw new ApiError(400, "WEBHOOK_NAME_REQUIRED");
    if (!url || !URL.canParse(url)) throw new ApiError(400, "WEBHOOK_URL_INVALID");

    const events = Array.isArray(body.events) ? body.events : [];
    for (const e of events) {
      if (!WebhookEventSchema.safeParse(e).success) {
        throw new ApiError(400, "WEBHOOK_EVENT_INVALID", { event: e });
      }
    }
    if (events.length === 0) throw new ApiError(400, "WEBHOOK_EVENTS_REQUIRED");

    const secret = prepareWebhookSecret();
    const row = await prisma.webhook.create({
      data: {
        name,
        url,
        // Signing secret stored for HMAC (shown once as plaintext).
        secretHash: secret.storedSecret,
        secretPrefix: secret.secretPrefix,
        events,
        createdBy: actorUserId(actor),
      },
    });

    await recordAudit({
      userId: actorUserId(actor),
      action: "webhook.create",
      targetType: "webhook",
      targetId: row.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { name, url, events },
    });

    return NextResponse.json({
      webhook: {
        id: row.id,
        name: row.name,
        url: row.url,
        secretPrefix: row.secretPrefix,
        events: row.events,
        enabled: row.enabled,
        createdAt: row.createdAt,
      },
      plaintextSecret: secret.plaintext,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
