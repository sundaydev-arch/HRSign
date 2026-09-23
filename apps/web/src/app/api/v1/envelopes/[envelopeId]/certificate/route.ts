import { handleApiError } from "@/lib/api";
import { assertEnvelopeAccess, requireV1Hr } from "@/lib/v1-authz";
import { NextResponse, type NextRequest } from "next/server";
import { getEnvelopeOrThrow, buildCertificate } from "@/lib/envelopes";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    const actor = await requireV1Hr();
    const { envelopeId } = await ctx.params;
    const envAccess = await getEnvelopeOrThrow(envelopeId);
    assertEnvelopeAccess(actor, envAccess);
    return NextResponse.json(await buildCertificate(envelopeId));
  } catch (err) {
    return handleApiError(err);
  }
}
