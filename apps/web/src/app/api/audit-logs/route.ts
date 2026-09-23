import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/api";
import { auditActionGroupPrefixes } from "@/lib/audit-actions";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireApiUser(["HR", "SUPER_ADMIN"]);
    const sp = req.nextUrl.searchParams;
    const userId = sp.get("userId") ?? undefined;
    const action = sp.get("action") ?? undefined;
    const group = sp.get("group") ?? undefined;
    const from = sp.get("from");
    const to = sp.get("to");
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") ?? 50)));

    const prefixes = group ? auditActionGroupPrefixes(group) : null;
    const actionFilter: Prisma.AuditLogWhereInput | undefined = prefixes
      ? {
          OR: prefixes.map((prefix) => ({ action: { startsWith: prefix } })),
        }
      : action
        ? { action: { contains: action } }
        : undefined;

    const where: Prisma.AuditLogWhereInput = {
      ...(userId ? { userId } : {}),
      ...actionFilter,
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
            },
          }
        : {}),
    };

    const format = sp.get("format");
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: format === "csv" ? 0 : (page - 1) * pageSize,
        take: format === "csv" ? 5000 : pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    if (format === "csv") {
      const header = ["time", "actor", "email", "action", "targetType", "targetId", "ip", "userAgent"];
      const rows = logs.map((l) =>
        [
          l.createdAt.toISOString(),
          l.user?.fullName ?? "",
          l.user?.email ?? "",
          l.action,
          l.targetType ?? "",
          l.targetId ?? "",
          l.ip ?? "",
          (l.userAgent ?? "").replace(/"/g, '""'),
        ]
          .map((c) => `"${String(c)}"`)
          .join(","),
      );
      const csv = [header.join(","), ...rows].join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="audit-logs.csv"',
        },
      });
    }

    return NextResponse.json({ logs, total, page, pageSize });
  } catch (err) {
    return handleApiError(err);
  }
}
