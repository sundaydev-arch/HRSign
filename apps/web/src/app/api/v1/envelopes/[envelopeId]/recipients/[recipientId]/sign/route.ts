import { handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { signAsRecipient, toEnvelopeDto } from "@/lib/envelopes";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string; recipientId: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { envelopeId, recipientId } = await ctx.params;
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
