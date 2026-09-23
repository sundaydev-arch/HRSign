import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { actorUserId, requireApiKeyOrSession } from "@/lib/api-auth";
import { createSigningTask, type CreateTaskBody } from "@/lib/create-task";
import { getRequestDbLocale, templateLocaleWhere } from "@/i18n/request-locale";
import { prisma } from "@/lib/prisma";
import { isManagerRole } from "@/lib/rbac";
import { expireDueTasks, getCurrentSigners } from "@/lib/tasks";
import { rateLimitChecked } from "@/lib/rate-limit";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireApiKeyOrSession();
    await expireDueTasks();
    const tab = req.nextUrl.searchParams.get("tab") ?? "all";
    const userId = actorUserId(actor);
    const role = actor.role;
    const locale = await getRequestDbLocale();
    const localeFilter = {
      document: { templateVersion: { template: templateLocaleWhere(locale) } },
    } as const;

    const include = {
      document: { select: { category: true } },
      creator: { select: { fullName: true } },
      signers: { select: { id: true, userId: true, signRole: true, status: true, order: true } },
    } as const;

    let tasks;
    if (tab === "pending-approve") {
      const rows = await prisma.signingTask.findMany({
        where: {
          ...localeFilter,
          approvalStatus: "PENDING",
          signers: { some: { userId, signRole: "APPROVER", status: "PENDING" } },
        },
        include,
        orderBy: { createdAt: "desc" },
      });
      tasks = rows.filter((t) => getCurrentSigners(t.flowType, t.signers).some((s) => s.userId === userId));
    } else if (tab === "pending-sign") {
      const rows = await prisma.signingTask.findMany({
        where: {
          ...localeFilter,
          signingStatus: "IN_PROGRESS",
          signers: { some: { userId, signRole: { not: "APPROVER" }, status: "PENDING" } },
        },
        include,
        orderBy: { createdAt: "desc" },
      });
      tasks = rows.filter((t) => getCurrentSigners(t.flowType, t.signers).some((s) => s.userId === userId));
    } else if (tab === "mine") {
      tasks = await prisma.signingTask.findMany({
        where: { ...localeFilter, createdBy: userId },
        include,
        orderBy: { createdAt: "desc" },
      });
    } else if (isManagerRole(role)) {
      tasks = await prisma.signingTask.findMany({
        where: localeFilter,
        include,
        orderBy: { createdAt: "desc" },
      });
    } else if (role === "DEPT_LEADER") {
      const me = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      tasks = await prisma.signingTask.findMany({
        where: {
          ...localeFilter,
          OR: [
            { createdBy: userId },
            { signers: { some: { userId } } },
            ...(me?.departmentId
              ? [{ creator: { departmentId: me.departmentId } }]
              : []),
          ],
        },
        include,
        orderBy: { createdAt: "desc" },
      });
    } else {
      tasks = await prisma.signingTask.findMany({
        where: {
          ...localeFilter,
          OR: [{ createdBy: userId }, { signers: { some: { userId } } }],
        },
        include,
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        approvalStatus: t.approvalStatus,
        signingStatus: t.signingStatus,
        flowType: t.flowType,
        category: t.document.category,
        creatorName: t.creator.fullName,
        signerCount: t.signers.length,
        expiresAt: t.expiresAt,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiKeyOrSession(["HR", "SUPER_ADMIN"]);
    const rl = rateLimitChecked({
      key: `tasks:create:${getClientIp(req)}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", { retryAfter: rl.retryAfterSeconds });

    const body = (await req.json()) as CreateTaskBody;
    const result = await createSigningTask({
      body,
      userId: actorUserId(actor),
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
