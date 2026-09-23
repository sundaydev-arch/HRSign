import { handleApiError } from "@/lib/api";
import { actorUserId, requireApiKeyOrSession } from "@/lib/api-auth";
import {
  createAccount,
  ensureDefaultAccount,
  toAccountDto,
} from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireApiKeyOrSession();
    // Ensure at least one account exists for the org
    await ensureDefaultAccount(actorUserId(actor));
    const rows = await prisma.account.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        members: { include: { user: { select: { email: true, fullName: true } } } },
        brands: true,
        _count: { select: { envelopes: true, members: true, brands: true } },
      },
    });
    return NextResponse.json({ accounts: rows.map((r) => toAccountDto(r)) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiKeyOrSession(["SUPER_ADMIN", "HR"]);
    const body = (await req.json()) as { name?: string; slug?: string };
    const row = await createAccount({
      name: body.name ?? "Untitled Account",
      slug: body.slug,
      ownerUserId: actorUserId(actor),
    });
    return NextResponse.json(toAccountDto(row), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
