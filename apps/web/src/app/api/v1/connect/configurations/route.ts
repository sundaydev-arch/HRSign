import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { actorUserId, requireApiKeyOrSession } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { WebhookEventSchema } from "@/schemas/webhook-payload";
import { prepareWebhookSecret } from "@/server/webhooks/dispatch";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

function toConnectDto(
  row: {
    id: string;
    name: string;
    url: string;
    events: string[];
    enabled: boolean;
    secretPrefix: string;
    createdAt: Date;
  },
  secret?: string,
) {
  return {
    configurationId: row.id,
    name: row.name,
    url: row.url,
    events: row.events,
    enabled: row.enabled,
    secretPrefix: row.secretPrefix,
    createdAt: row.createdAt.toISOString(),
    ...(secret ? { secret } : {}),
  };
}

export async function GET() {
  try {
    await requireApiKeyOrSession(["SUPER_ADMIN"]);
    const rows = await prisma.webhook.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({
      configurations: rows.map((r) => toConnectDto(r)),
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
      enabled?: boolean;
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
        events,
        enabled: body.enabled !== false,
        secretHash: secret.storedSecret,
        secretPrefix: secret.secretPrefix,
        createdBy: actorUserId(actor),
      },
    });
    await recordAudit({
      userId: actorUserId(actor),
      action: "connect.create",
      targetType: "webhook",
      targetId: row.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { name, url, events },
    });
    return NextResponse.json(toConnectDto(row, secret.plaintext), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
