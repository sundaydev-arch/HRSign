import { ApiError, handleApiError } from "@/lib/api";
import { requireV1Hr } from "@/lib/v1-authz";
import { toClickwrapDto } from "@/lib/platform-products";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireV1Hr();
    const { id } = await ctx.params;
    const row = await prisma.clickwrap.findUnique({
      where: { id },
      include: { _count: { select: { acceptances: true } } },
    });
    if (!row) throw new ApiError(404, "CLICKWRAP_NOT_FOUND");
    return NextResponse.json(toClickwrapDto(row));
  } catch (err) {
    return handleApiError(err);
  }
}
