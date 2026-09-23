import { handleApiError } from "@/lib/api";
import { assertEnvelopeAccess, requireV1Hr } from "@/lib/v1-authz";
import { buildEvidencePack } from "@/lib/evidence-pack";
import { NextResponse, type NextRequest } from "next/server";
import { getEnvelopeOrThrow } from "@/lib/envelopes";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    const actor = await requireV1Hr();
    const { envelopeId } = await ctx.params;
    const envAccess = await getEnvelopeOrThrow(envelopeId);
    assertEnvelopeAccess(actor, envAccess);
    const pack = await buildEvidencePack(envelopeId);
    const download = req.nextUrl.searchParams.get("download") === "1";
    if (download) {
      return new NextResponse(JSON.stringify(pack, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="evidence-${envelopeId}.json"`,
        },
      });
    }
    return NextResponse.json(pack);
  } catch (err) {
    return handleApiError(err);
  }
}
