import { ApiError, handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { toClmDto } from "@/lib/platform-products";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireApiKeyOrSession();
    const rows = await prisma.clmAgreement.findMany({ orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ agreements: rows.map((r) => toClmDto(r)) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireApiKeyOrSession();
    const body = (await req.json()) as {
      name?: string;
      counterparty?: string;
      envelopeId?: string;
      effectiveOn?: string;
      expiresOn?: string;
      notes?: string;
      status?: string;
    };
    if (!body.name?.trim()) throw new ApiError(400, "VALIDATION_FAILED");
    const row = await prisma.clmAgreement.create({
      data: {
        name: body.name.trim(),
        counterparty: body.counterparty?.trim() || null,
        envelopeId: body.envelopeId || null,
        effectiveOn: body.effectiveOn ? new Date(body.effectiveOn) : null,
        expiresOn: body.expiresOn ? new Date(body.expiresOn) : null,
        notes: body.notes?.trim() || null,
        status: body.status ?? "draft",
      },
    });
    return NextResponse.json(toClmDto(row), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
