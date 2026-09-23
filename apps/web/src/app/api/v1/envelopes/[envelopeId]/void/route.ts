import { ApiError, handleApiError } from "@/lib/api";
import { assertEnvelopeAccess, requireV1Hr } from "@/lib/v1-authz";
import { NextResponse, type NextRequest } from "next/server";
import { getEnvelopeOrThrow, toEnvelopeDto, voidEnvelope } from "@/lib/envelopes";

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
    const body = (await req.json()) as { reason?: string };
    if (!body.reason?.trim()) throw new ApiError(400, "VALIDATION_FAILED");
    const env = await voidEnvelope(envelopeId, body.reason);
    return NextResponse.json(toEnvelopeDto(env));
  } catch (err) {
    return handleApiError(err);
  }
}
