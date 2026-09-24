import { ApiError, handleApiError } from "@/lib/api";
import { actorUserId } from "@/lib/api-auth";
import {
  createEnvelope,
  toEnvelopeDto,
  type EnvelopeDto,
} from "@/lib/envelopes";
import { prisma } from "@/lib/prisma";
import { envelopeAccessWhere, requireV1Hr, resolveAccountScope } from "@/lib/v1-authz";
import { requirePermission } from "@/lib/permissions";
import type { RecipientType } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireV1Hr();
    await requirePermission(actor, "envelope.read");
    const scope = await resolveAccountScope(actor);
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const limit = Math.min(200, Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50);
    const rows = await prisma.envelope.findMany({
      where: {
        ...envelopeAccessWhere(actor, scope),
        ...(status ? { status: status as never } : {}),
      },
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
    const actor = await requireV1Hr();
    await requirePermission(actor, "envelope.create");
    const scope = await resolveAccountScope(actor);
    const body = (await req.json()) as {
      subject?: string;
      emailBlurb?: string;
      expiresAt?: string;
      accountId?: string;
      documents?: Array<{ name: string; documentOrder?: number; blank?: boolean }>;
      recipients?: Array<{
        recipientType: RecipientType;
        routingOrder: number;
        name: string;
        email: string;
        phoneE164?: string;
        deliveryChannel?: string;
        idvMethod?: string;
      }>;
    };
    if (!body.subject?.trim()) throw new ApiError(400, "VALIDATION_FAILED");
    const accountId = body.accountId ?? scope.accountId ?? undefined;
    const env = await createEnvelope({
      subject: body.subject.trim(),
      emailBlurb: body.emailBlurb,
      expiresAt: body.expiresAt,
      createdBy: actorUserId(actor),
      accountId,
      documents: body.documents,
      recipients: body.recipients,
    });
    return NextResponse.json(toEnvelopeDto(env), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
