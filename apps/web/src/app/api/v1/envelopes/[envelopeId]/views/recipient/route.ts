import { ApiError, handleApiError } from "@/lib/api";
import { assertEnvelopeAccess, requireV1Hr } from "@/lib/v1-authz";
import { createRecipientEmbeddedView } from "@/lib/embedded-view";
import { NextResponse, type NextRequest } from "next/server";
import { getEnvelopeOrThrow } from "@/lib/envelopes";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    const actor = await requireV1Hr();
    const { envelopeId } = await ctx.params;
    const envAccess = await getEnvelopeOrThrow(envelopeId);
    assertEnvelopeAccess(actor, envAccess);
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
