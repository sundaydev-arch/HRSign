import { handleApiError } from "@/lib/api";
import { assertEnvelopeAccess, requireV1Hr } from "@/lib/v1-authz";
import { NextResponse, type NextRequest } from "next/server";
import { getEnvelopeOrThrow, sendEnvelope, toEnvelopeDto } from "@/lib/envelopes";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    const actor = await requireV1Hr();
    const { envelopeId } = await ctx.params;
    const envAccess = await getEnvelopeOrThrow(envelopeId);
    assertEnvelopeAccess(actor, envAccess);
    const { envelope, tokens } = await sendEnvelope(envelopeId);
    return NextResponse.json(toEnvelopeDto(envelope, tokens));
  } catch (err) {
    return handleApiError(err);
  }
}
