import { handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { getEnvelopeOrThrow, toEnvelopeDto } from "@/lib/envelopes";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { envelopeId } = await ctx.params;
    const env = await getEnvelopeOrThrow(envelopeId);
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
    await requireApiKeyOrSession();
    const { envelopeId } = await ctx.params;
    const env = await getEnvelopeOrThrow(envelopeId);
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
