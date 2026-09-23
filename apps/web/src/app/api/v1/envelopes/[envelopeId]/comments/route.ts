import { ApiError, handleApiError } from "@/lib/api";
import { actorUserId, requireApiKeyOrSession } from "@/lib/api-auth";
import { getEnvelopeOrThrow } from "@/lib/envelopes";
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
    await getEnvelopeOrThrow(envelopeId);
    const comments = await prisma.envelopeComment.findMany({
      where: { envelopeId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        authorName: c.authorName,
        documentId: c.documentId,
        page: c.page,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    const actor = await requireApiKeyOrSession();
    const { envelopeId } = await ctx.params;
    await getEnvelopeOrThrow(envelopeId);
    const body = (await req.json()) as { body?: string; documentId?: string; page?: number };
    if (!body.body?.trim()) throw new ApiError(400, "VALIDATION_FAILED");
    const name = actor.kind === "session" ? actor.name : actor.name;
    const row = await prisma.envelopeComment.create({
      data: {
        envelopeId,
        authorId: actorUserId(actor),
        authorName: name,
        body: body.body.trim(),
        documentId: body.documentId ?? null,
        page: body.page ?? null,
      },
    });
    return NextResponse.json(
      {
        id: row.id,
        body: row.body,
        authorName: row.authorName,
        documentId: row.documentId,
        page: row.page,
        createdAt: row.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
