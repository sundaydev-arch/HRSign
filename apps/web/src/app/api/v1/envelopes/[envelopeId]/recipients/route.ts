import { ApiError, handleApiError } from "@/lib/api";
import { assertEnvelopeAccess, requireV1Hr } from "@/lib/v1-authz";
import { prisma } from "@/lib/prisma";
import type { RecipientType } from "@prisma/client";
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
    return NextResponse.json({ recipients: toEnvelopeDto(env).recipients });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    const actor = await requireV1Hr();
    const { envelopeId } = await ctx.params;
    const env = await getEnvelopeOrThrow(envelopeId);
    assertEnvelopeAccess(actor, env);
    if (env.status !== "created") throw new ApiError(409, "ENVELOPE_INVALID_STATE");
    const body = (await req.json()) as {
      recipients: Array<{
        recipientType: RecipientType;
        routingOrder: number;
        name: string;
        email: string;
        userId?: string;
      }>;
    };
    await prisma.$transaction(async (tx) => {
      await tx.envelopeRecipient.deleteMany({ where: { envelopeId } });
      await tx.envelopeRecipient.createMany({
        data: (body.recipients ?? []).map((r) => ({
          envelopeId,
          recipientType: r.recipientType,
          routingOrder: r.routingOrder,
          name: r.name,
          email: r.email.toLowerCase(),
          userId: r.userId ?? null,
        })),
      });
    });
    const fresh = await getEnvelopeOrThrow(envelopeId);
    return NextResponse.json({ recipients: toEnvelopeDto(fresh).recipients });
  } catch (err) {
    return handleApiError(err);
  }
}
