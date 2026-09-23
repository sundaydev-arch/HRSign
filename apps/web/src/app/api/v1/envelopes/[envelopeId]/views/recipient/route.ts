import { ApiError, handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { createRecipientEmbeddedView } from "@/lib/embedded-view";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { envelopeId } = await ctx.params;
    const body = (await req.json()) as {
      recipientId?: string;
      returnUrl?: string;
      frameAncestors?: string[];
    };
    if (!body.recipientId || !body.returnUrl) throw new ApiError(400, "VALIDATION_FAILED");
    const view = await createRecipientEmbeddedView({
      envelopeId,
      recipientId: body.recipientId,
      returnUrl: body.returnUrl,
      frameAncestors: body.frameAncestors,
    });
    return NextResponse.json(view, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
