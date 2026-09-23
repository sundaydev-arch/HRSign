import { ApiError, handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { toRoomDto } from "@/lib/platform-products";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { id } = await ctx.params;
    const row = await prisma.room.findUnique({
      where: { id },
      include: { members: true, documents: true },
    });
    if (!row) throw new ApiError(404, "ROOM_NOT_FOUND");
    return NextResponse.json(toRoomDto(row));
  } catch (err) {
    return handleApiError(err);
  }
}
