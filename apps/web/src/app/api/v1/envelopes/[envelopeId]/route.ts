import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assertEnvelopeAccess, requireV1Hr } from "@/lib/v1-authz";
import { NextResponse, type NextRequest } from "next/server";
import { getEnvelopeOrThrow, toEnvelopeDto } from "@/lib/envelopes";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    const actor = await requireV1Hr();
    const { envelopeId } = await ctx.params;
    const env = await getEnvelopeOrThrow(envelopeId);
    assertEnvelopeAccess(actor, env);
    return NextResponse.json(toEnvelopeDto(env));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    const actor = await requireV1Hr();
    const { envelopeId } = await ctx.params;
    const env = await getEnvelopeOrThrow(envelopeId);
    assertEnvelopeAccess(actor, env);
    if (env.status !== "created") {
      return NextResponse.json(
        { error: { code: "ENVELOPE_INVALID_STATE" } },
        { status: 409 },
      );
    }
    await prisma.envelope.delete({ where: { id: envelopeId } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
