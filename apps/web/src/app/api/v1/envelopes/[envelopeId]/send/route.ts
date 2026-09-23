import { handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { sendEnvelope, toEnvelopeDto } from "@/lib/envelopes";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { envelopeId } = await ctx.params;
    const { envelope, tokens } = await sendEnvelope(envelopeId);
    return NextResponse.json(toEnvelopeDto(envelope, tokens));
  } catch (err) {
    return handleApiError(err);
  }
}
