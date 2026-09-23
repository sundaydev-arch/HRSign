import { ApiError, handleApiError } from "@/lib/api";
import { requireV1Hr } from "@/lib/v1-authz";
import { createClickwrap, toClickwrapDto } from "@/lib/platform-products";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireV1Hr();
    const rows = await prisma.clickwrap.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { acceptances: true } } },
    });
    return NextResponse.json({
      clickwraps: rows.map((r) => toClickwrapDto(r, { includeBody: false })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireV1Hr();
    const body = (await req.json()) as {
      name?: string;
      displayName?: string;
      bodyHtml?: string;
      requireScroll?: boolean;
      status?: string;
    };
    if (!body.name?.trim()) throw new ApiError(400, "VALIDATION_FAILED");
    const row = await createClickwrap({
      name: body.name,
      displayName: body.displayName,
      bodyHtml: body.bodyHtml,
      requireScroll: body.requireScroll,
      status: body.status,
    });
    return NextResponse.json(toClickwrapDto(row), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
