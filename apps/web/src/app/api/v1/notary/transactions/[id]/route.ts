import { ApiError, handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { toNotaryDto } from "@/lib/platform-products";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { id } = await ctx.params;
    const body = (await req.json()) as { status?: string; notes?: string };
    const existing = await prisma.notaryTransaction.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "NOTARY_TX_NOT_FOUND");
    const status = body.status ?? existing.status;
    const row = await prisma.notaryTransaction.update({
      where: { id },
      data: {
        status,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        completedAt: status === "completed" ? new Date() : existing.completedAt,
      },
    });
    return NextResponse.json(toNotaryDto(row));
  } catch (err) {
    return handleApiError(err);
  }
}
