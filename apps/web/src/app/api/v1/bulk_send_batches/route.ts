import { ApiError, handleApiError } from "@/lib/api";
import { actorUserId, requireApiKeyOrSession } from "@/lib/api-auth";
import { createBulkSendBatch, listBulkSendBatches, type BulkRow } from "@/lib/bulk-send";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireApiKeyOrSession();
    const limit = Math.min(200, Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50);
    return NextResponse.json({ batches: await listBulkSendBatches(limit) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiKeyOrSession();
    const body = (await req.json()) as {
      templateId?: string;
      rows?: BulkRow[];
      emailBlurb?: string;
      send?: boolean;
    };
    if (!body.templateId || !Array.isArray(body.rows) || body.rows.length === 0) {
      throw new ApiError(400, "VALIDATION_FAILED");
    }
    const result = await createBulkSendBatch({
      templateId: body.templateId,
      rows: body.rows,
      createdBy: actorUserId(actor),
      emailBlurb: body.emailBlurb,
      send: body.send,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
