import { handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { getAccountOrThrow, toAccountDto } from "@/lib/accounts";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ accountId: string }> },
) {
  try {
    await requireApiKeyOrSession();
    const { accountId } = await ctx.params;
    const row = await getAccountOrThrow(accountId);
    return NextResponse.json(toAccountDto(row));
  } catch (err) {
    return handleApiError(err);
  }
}
