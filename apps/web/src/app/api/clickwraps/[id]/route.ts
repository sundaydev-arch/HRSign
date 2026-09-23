import { ApiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toClickwrapDto } from "@/lib/platform-products";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Public read of an active clickwrap (for agreement page). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const row = await prisma.clickwrap.findUnique({ where: { id } });
    if (!row || row.status !== "active") throw new ApiError(404, "CLICKWRAP_NOT_FOUND");
    return NextResponse.json(toClickwrapDto(row));
  } catch (err) {
    return handleApiError(err);
  }
}
