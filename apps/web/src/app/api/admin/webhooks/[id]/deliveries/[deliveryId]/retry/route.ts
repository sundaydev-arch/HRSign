import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/rbac";
import { enqueueJob } from "@/server/jobs/queue";
import { retryWebhookDelivery } from "@/server/webhooks/dispatch";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; deliveryId: string }> },
) {
  const { id, deliveryId } = await params;
  try {
    await requireApiUser(["SUPER_ADMIN"]);
    const delivery = await prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, webhookId: id },
    });
    if (!delivery) throw new ApiError(404, "WEBHOOK_NOT_FOUND");

    const queued = await enqueueJob("webhook.retry", { deliveryId });
    if (!queued) {
      const result = await retryWebhookDelivery(deliveryId);
      return NextResponse.json({ ok: result.ok, inline: true });
    }
    return NextResponse.json({ ok: true, queued: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export const runtime = "nodejs";
