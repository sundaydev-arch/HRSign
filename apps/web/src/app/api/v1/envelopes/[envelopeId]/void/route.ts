import { ApiError, handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { toEnvelopeDto, voidEnvelope } from "@/lib/envelopes";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { envelopeId } = await ctx.params;
    const body = (await req.json()) as { reason?: string };
    if (!body.reason?.trim()) throw new ApiError(400, "VALIDATION_FAILED");
    const env = await voidEnvelope(envelopeId, body.reason);
    return NextResponse.json(toEnvelopeDto(env));
  } catch (err) {
    return handleApiError(err);
  }
}
