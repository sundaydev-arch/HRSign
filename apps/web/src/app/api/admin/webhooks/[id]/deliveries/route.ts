import { ApiError, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** List recent webhook deliveries for admin retry UI. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser(["SUPER_ADMIN"]);
    const { id } = await params;
    const webhook = await prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new ApiError(404, "WEBHOOK_NOT_FOUND");

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ deliveries });
  } catch (err) {
    return handleApiError(err);
  }
}
