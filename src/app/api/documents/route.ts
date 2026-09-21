import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isManagerRole, requireApiUser } from "@/lib/rbac";
import { NextResponse } from "next/server";

/** Archived document list: HR/super admins see all documents; other users see only those they created or participate in. */
export async function GET() {
  try {
    const user = await requireApiUser();
    const documents = await prisma.document.findMany({
      where: isManagerRole(user.role)
        ? {}
        : {
          OR: [
            { createdBy: user.id },
            { signingTask: { signers: { some: { userId: user.id } } } },
          ],
        },
      include: {
        creator: { select: { fullName: true } },
        templateVersion: { select: { template: { select: { name: true } } } },
        signingTask: { select: { id: true, approvalStatus: true, signingStatus: true } },
        versions: {
          orderBy: { version: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ documents });
  } catch (err) {
    return handleApiError(err);
  }
}
