import { ApiError, handleApiError } from "@/lib/api";
import { actorUserId, requireApiKeyOrSession } from "@/lib/api-auth";
import { toRoomDto } from "@/lib/platform-products";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireApiKeyOrSession();
    const rows = await prisma.room.findMany({
      orderBy: { updatedAt: "desc" },
      include: { members: true, documents: true },
    });
    return NextResponse.json({ rooms: rows.map((r) => toRoomDto(r)) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiKeyOrSession();
    const body = (await req.json()) as {
      name?: string;
      description?: string;
      members?: Array<{ name: string; email: string; role?: string }>;
      documents?: Array<{ name: string; envelopeId?: string }>;
    };
    if (!body.name?.trim()) throw new ApiError(400, "VALIDATION_FAILED");
    const row = await prisma.room.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        ownerId: actorUserId(actor),
        members: body.members?.length
          ? {
              create: body.members.map((m) => ({
                name: m.name.trim(),
                email: m.email.trim().toLowerCase(),
                role: m.role ?? "viewer",
              })),
            }
          : undefined,
        documents: body.documents?.length
          ? {
              create: body.documents.map((d) => ({
                name: d.name.trim(),
                envelopeId: d.envelopeId ?? null,
              })),
            }
          : undefined,
      },
      include: { members: true, documents: true },
    });
    return NextResponse.json(toRoomDto(row), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
