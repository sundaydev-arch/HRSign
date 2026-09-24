import { handleApiError } from "@/lib/api";
import { listPermissionMatrix } from "@/lib/permissions";
import { requireV1Admin } from "@/lib/v1-authz";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Read-only role × permission matrix for operators. */
export async function GET() {
  try {
    await requireV1Admin();
    const matrix = await listPermissionMatrix();
    return NextResponse.json({ matrix });
  } catch (err) {
    return handleApiError(err);
  }
}
