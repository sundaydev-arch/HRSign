import { ApiError, handleApiError } from "@/lib/api";
import { requireV1Hr } from "@/lib/v1-authz";
import { toClmDto } from "@/lib/platform-products";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireV1Hr();
    const { id } = await ctx.params;
    const body = (await req.json()) as { status?: string; notes?: string };
    const existing = await prisma.clmAgreement.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "CLM_AGREEMENT_NOT_FOUND");
    const row = await prisma.clmAgreement.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
    });
    return NextResponse.json(toClmDto(row));
  } catch (err) {
    return handleApiError(err);
  }
}
