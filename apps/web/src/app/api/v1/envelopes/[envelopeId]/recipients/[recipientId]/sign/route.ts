import { handleApiError } from "@/lib/api";
import { assertEnvelopeAccess, requireV1Hr } from "@/lib/v1-authz";
import { NextResponse, type NextRequest } from "next/server";
import { getEnvelopeOrThrow, signAsRecipient, toEnvelopeDto } from "@/lib/envelopes";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string; recipientId: string }> },
) {
  try {
    const actor = await requireV1Hr();
    const { envelopeId, recipientId } = await ctx.params;
    const envAccess = await getEnvelopeOrThrow(envelopeId);
    assertEnvelopeAccess(actor, envAccess);
    const body = (await req.json().catch(() => ({}))) as {
      tabValues?: Record<string, string>;
      signatureImageBase64?: string;
    };
    const env = await signAsRecipient(envelopeId, recipientId, body);
    return NextResponse.json(toEnvelopeDto(env));
  } catch (err) {
    return handleApiError(err);
  }
}
