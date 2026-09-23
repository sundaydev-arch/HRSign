import { handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { buildCertificate } from "@/lib/envelopes";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { envelopeId } = await ctx.params;
    return NextResponse.json(await buildCertificate(envelopeId));
  } catch (err) {
    return handleApiError(err);
  }
}
