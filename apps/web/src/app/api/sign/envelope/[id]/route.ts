import { ApiError, handleApiError } from "@/lib/api";
import {
  assertRecipientToken,
  markRecipientViewed,
  signAsRecipient,
  toEnvelopeDto,
} from "@/lib/envelopes";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/** Public recipient view — token in query `t` + recipient `r`. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const r = req.nextUrl.searchParams.get("r");
    const t = req.nextUrl.searchParams.get("t") ?? req.nextUrl.searchParams.get("embed");
    if (!r || !t) throw new ApiError(401, "SIGN_LINK_INVALID");
    await assertRecipientToken(id, r, t);
    const env = await markRecipientViewed(id, r);
    const dto = toEnvelopeDto(env);
    const mine = dto.recipients.find((x) => x.id === r);
    const { filterVisibleTabs } = await import("@/lib/conditional-tabs");
    const myTabs = filterVisibleTabs(
      dto.tabs.filter((tab) => tab.recipientId === r || tab.recipientId == null),
    );
    return NextResponse.json({
      envelope: {
        id: dto.id,
        subject: dto.subject,
        status: dto.status,
        emailBlurb: dto.emailBlurb,
        documents: dto.documents,
      },
      recipient: mine
        ? {
            id: mine.id,
            name: mine.name,
            email: mine.email,
            status: mine.status,
            recipientType: mine.recipientType,
            phoneE164: mine.phoneE164,
            idvMethod: mine.idvMethod,
            idvStatus: mine.idvStatus,
            deliveryChannel: mine.deliveryChannel,
          }
        : null,
      tabs: myTabs,
      idvRequired: Boolean(mine && mine.idvMethod !== "none" && mine.idvStatus !== "verified"),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      recipientId?: string;
      token?: string;
      tabValues?: Record<string, string>;
      signatureImageBase64?: string;
      decline?: boolean;
      declineReason?: string;
    };
    if (!body.recipientId || !body.token) throw new ApiError(401, "SIGN_LINK_INVALID");
    await assertRecipientToken(id, body.recipientId, body.token);

    if (body.decline) {
      const { prisma } = await import("@/lib/prisma");
      await prisma.envelopeRecipient.update({
        where: { id: body.recipientId },
        data: {
          status: "declined",
          declinedAt: new Date(),
          declineReason: body.declineReason?.trim() || null,
        },
      });
      await prisma.envelope.update({
        where: { id },
        data: { status: "declined" },
      });
      await prisma.envelopeEvent.create({
        data: {
          envelopeId: id,
          action: "recipient_declined",
          meta: { recipientId: body.recipientId, reason: body.declineReason },
        },
      });
      void import("@/server/webhooks/dispatch").then(({ dispatchWebhookEvent }) =>
        dispatchWebhookEvent("envelope.declined", {
          data: { envelopeId: id, recipientId: body.recipientId },
        }),
      );
      const { getEnvelopeOrThrow, toEnvelopeDto: toDto } = await import("@/lib/envelopes");
      return NextResponse.json(toDto(await getEnvelopeOrThrow(id)));
    }

    const env = await signAsRecipient(id, body.recipientId, {
      tabValues: body.tabValues,
      signatureImageBase64: body.signatureImageBase64,
    });
    return NextResponse.json(toEnvelopeDto(env));
  } catch (err) {
    return handleApiError(err);
  }
}
