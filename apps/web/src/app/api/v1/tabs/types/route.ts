import { TAB_TYPES } from "@/lib/envelopes";
import { requireV1Hr } from "@/lib/v1-authz";
import { handleApiError } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireV1Hr();
    return NextResponse.json({ types: [...TAB_TYPES] });
  } catch (err) {
    return handleApiError(err);
  }
}
