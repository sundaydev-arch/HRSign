import { ApiError, handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { getEnvelopeOrThrow, toEnvelopeDto } from "@/lib/envelopes";
import { prisma } from "@/lib/prisma";
import type { RecipientType } from "@prisma/client";
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
    await requireApiKeyOrSession();
    const { envelopeId } = await ctx.params;
    const env = await getEnvelopeOrThrow(envelopeId);
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
