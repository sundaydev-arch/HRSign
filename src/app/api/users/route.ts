import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/api";

/** Internal user pick-list (for choosing approvers/signers when creating a task). */
export async function GET() {
  try {
    await requireApiUser(["HR", "SUPER_ADMIN"]);
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, email: true, role: true },
      orderBy: { fullName: "asc" },
    });
    return NextResponse.json({ users });
  } catch (err) {
    return handleApiError(err);
  }
}
