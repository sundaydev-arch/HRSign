import { ApiError, handleApiError } from "@/lib/api";
import { requireApiKeyOrSession } from "@/lib/api-auth";
import { requireV1Hr } from "@/lib/v1-authz";
import { addAccountMember, getAccountOrThrow } from "@/lib/accounts";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ accountId: string }> },
) {
  try {
    await requireV1Hr();
    const { accountId } = await ctx.params;
    const row = await getAccountOrThrow(accountId);
    return NextResponse.json({
      members: row.members.map((m) => ({
        memberId: m.id,
        userId: m.userId,
        role: m.role,
        email: m.user?.email,
        name: m.user?.fullName,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ accountId: string }> },
) {
  try {
    await requireApiKeyOrSession(["SUPER_ADMIN", "HR"]);
    const { accountId } = await ctx.params;
    const body = (await req.json()) as { email?: string; role?: string };
    if (!body.email?.trim()) throw new ApiError(400, "VALIDATION_FAILED");
    const member = await addAccountMember({
      accountId,
      email: body.email,
      role: body.role,
    });
    return NextResponse.json(
      {
        memberId: member.id,
        userId: member.userId,
        role: member.role,
        email: member.user.email,
        name: member.user.fullName,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
