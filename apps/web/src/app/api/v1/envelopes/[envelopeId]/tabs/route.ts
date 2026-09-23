import { handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import {
  getEnvelopeOrThrow,
  replaceEnvelopeTabs,
  toEnvelopeDto,
  type TabInput,
} from "@/lib/envelopes";
import type { TabType } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { envelopeId } = await ctx.params;
    const env = await getEnvelopeOrThrow(envelopeId);
    return NextResponse.json({ tabs: toEnvelopeDto(env).tabs });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ envelopeId: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { envelopeId } = await ctx.params;
    const body = (await req.json()) as { tabs?: TabInput[] };
    const tabs = (body.tabs ?? []).map((t) => ({
      ...t,
      tabType: t.tabType as TabType,
    }));
    const env = await replaceEnvelopeTabs(envelopeId, tabs);
    return NextResponse.json({ tabs: toEnvelopeDto(env).tabs });
  } catch (err) {
    return handleApiError(err);
  }
}
