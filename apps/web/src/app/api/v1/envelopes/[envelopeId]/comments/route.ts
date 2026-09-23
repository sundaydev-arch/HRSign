import { ApiError, handleApiError } from "@/lib/api";
import { actorUserId } from "@/lib/api-auth";
import { assertEnvelopeAccess, requireV1Hr } from "@/lib/v1-authz";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";
import { getEnvelopeOrThrow } from "@/lib/envelopes";

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
    const actor = await requireV1Hr();
    const { envelopeId } = await ctx.params;
    const env = await getEnvelopeOrThrow(envelopeId);
    assertEnvelopeAccess(actor, env);
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
