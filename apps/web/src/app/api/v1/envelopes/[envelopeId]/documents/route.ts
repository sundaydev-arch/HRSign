import { ApiError, handleApiError } from "@/lib/api";
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
    return NextResponse.json({ documents: toEnvelopeDto(env).documents });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { envelopeId } = await ctx.params;
    const env = await getEnvelopeOrThrow(envelopeId);
    if (env.status !== "created") throw new ApiError(409, "ENVELOPE_INVALID_STATE");
    const body = (await req.json()) as {
      name?: string;
      documentOrder?: number;
      storageKey?: string;
      pageCount?: number;
    };
    if (!body.name?.trim()) throw new ApiError(400, "VALIDATION_FAILED");
    const doc = await prisma.envelopeDocument.create({
      data: {
        envelopeId,
        name: body.name.trim(),
        documentOrder: body.documentOrder ?? env.documents.length + 1,
        storageKey: body.storageKey ?? null,
        pageCount: body.pageCount ?? 1,
      },
    });
    return NextResponse.json(
      {
        id: doc.id,
        name: doc.name,
        documentOrder: doc.documentOrder,
        storageKey: doc.storageKey,
        sha256: doc.sha256,
        pageCount: doc.pageCount,
        fileUrl: doc.storageKey ? `/api/files/${doc.storageKey}` : null,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
