import { ApiError, handleApiError } from "@/lib/api";
import { acceptClickwrap } from "@/lib/platform-products";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Public accept endpoint (no session). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      acceptorEmail?: string;
      acceptorName?: string;
    };
    if (!body.acceptorEmail?.trim()) throw new ApiError(400, "VALIDATION_FAILED");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const result = await acceptClickwrap({
      clickwrapId: id,
      acceptorEmail: body.acceptorEmail,
      acceptorName: body.acceptorName,
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
