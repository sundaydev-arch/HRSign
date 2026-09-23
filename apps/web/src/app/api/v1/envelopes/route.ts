import { handleApiError } from "@/lib/api";
import { actorUserId, requireApiKeyOrSession } from "@/lib/api-auth";
import {
  createEnvelope,
  toEnvelopeDto,
  type EnvelopeDto,
} from "@/lib/envelopes";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import type { RecipientType } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireApiKeyOrSession();
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const limit = Math.min(200, Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50);
    const rows = await prisma.envelope.findMany({
      where: status ? { status: status as never } : undefined,
      include: { documents: true, recipients: true, tabs: true },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
    return NextResponse.json({
      envelopes: rows.map((e) => toEnvelopeDto(e)) satisfies EnvelopeDto[],
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiKeyOrSession();
    const body = (await req.json()) as {
      subject?: string;
      emailBlurb?: string;
      expiresAt?: string;
      documents?: Array<{
        name: string;
        documentOrder?: number;
        storageKey?: string;
        pageCount?: number;
      }>;
      recipients?: Array<{
        recipientType: RecipientType;
        routingOrder: number;
        name: string;
        email: string;
        userId?: string;
        phoneE164?: string;
        deliveryChannel?: string;
        idvMethod?: string;
        hostUserId?: string;
        witnessForId?: string;
      }>;
    };
    if (!body.subject?.trim()) throw new ApiError(400, "ENVELOPE_SUBJECT_REQUIRED");
    const env = await createEnvelope({
      subject: body.subject,
      emailBlurb: body.emailBlurb,
      expiresAt: body.expiresAt,
      createdBy: actorUserId(actor),
      documents: body.documents,
      recipients: body.recipients,
    });
    return NextResponse.json(toEnvelopeDto(env), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
