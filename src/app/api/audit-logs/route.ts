import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requireApiUser(["HR", "SUPER_ADMIN"]);
    const sp = req.nextUrl.searchParams;
    const userId = sp.get("userId") ?? undefined;
    const action = sp.get("action") ?? undefined;
    const from = sp.get("from");
    const to = sp.get("to");
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") ?? 50)));

    const where = {
      ...(userId ? { userId } : {}),
      ...(action ? { action: { contains: action } } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, pageSize });
  } catch (err) {
    return handleApiError(err);
  }
}
