import { handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { buildEvidencePack } from "@/lib/evidence-pack";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { envelopeId } = await ctx.params;
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
