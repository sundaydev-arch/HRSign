import { ApiError, handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { toNotaryDto } from "@/lib/platform-products";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireApiKeyOrSession();
    const rows = await prisma.notaryTransaction.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ transactions: rows.map((r) => toNotaryDto(r)) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireApiKeyOrSession();
    const body = (await req.json()) as {
      envelopeId?: string;
      notaryName?: string;
      jurisdiction?: string;
      scheduledAt?: string;
      notes?: string;
    };
    const row = await prisma.notaryTransaction.create({
      data: {
        envelopeId: body.envelopeId || null,
        notaryName: body.notaryName?.trim() || null,
        jurisdiction: body.jurisdiction?.trim() || null,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        notes: body.notes?.trim() || null,
        status: body.scheduledAt ? "scheduled" : "created",
      },
    });
    return NextResponse.json(toNotaryDto(row), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
