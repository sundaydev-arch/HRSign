import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireApiUser, isManagerRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getCurrentSigners } from "@/lib/tasks";
import type { Prisma } from "@prisma/client";

type TaskScope = Prisma.SigningTaskWhereInput;

/** Workspace KPI + attention lists for the dashboard. */
export async function GET() {
  try {
    const user = await requireApiUser();
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const manager = isManagerRole(user.role);

    const scope: TaskScope =
      manager
        ? {}
        : user.role === "DEPT_LEADER"
          ? await deptScope(user.id)
          : {
              OR: [
                { createdBy: user.id },
                { signers: { some: { userId: user.id } } },
              ],
            };

    const include = {
      creator: { select: { fullName: true } },
      document: { select: { category: true } },
      signers: {
        select: { id: true, userId: true, signRole: true, status: true, order: true },
      },
    } as const;

    const [
      pendingApprove,
      pendingSign,
      expiring7d,
      overdue,
      completed30d,
      recentRows,
      myApproveRows,
      mySignRows,
      templatesPublished,
      templatesDraft,
      sealsEnabled,
      activity,
    ] = await Promise.all([
      prisma.signingTask.count({
        where: { ...scope, approvalStatus: "PENDING" },
      }),
      prisma.signingTask.count({
        where: {
          ...scope,
          approvalStatus: "APPROVED",
          signingStatus: "IN_PROGRESS",
        },
      }),
      prisma.signingTask.count({
        where: {
          ...scope,
          signingStatus: "IN_PROGRESS",
          expiresAt: { lte: in7d, gte: now },
        },
      }),
      prisma.signingTask.count({
        where: {
          ...scope,
          signingStatus: "IN_PROGRESS",
          expiresAt: { lt: now },
        },
      }),
      prisma.signingTask.count({
        where: {
          ...scope,
          signingStatus: "COMPLETED",
          updatedAt: { gte: ago30d },
        },
      }),
      prisma.signingTask.findMany({
        where: scope,
        include,
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.signingTask.findMany({
        where: {
          approvalStatus: "PENDING",
          signers: { some: { userId: user.id, signRole: "APPROVER", status: "PENDING" } },
        },
        include,
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.signingTask.findMany({
        where: {
          signingStatus: "IN_PROGRESS",
          signers: {
            some: { userId: user.id, signRole: { not: "APPROVER" }, status: "PENDING" },
          },
        },
        include,
        orderBy: { expiresAt: "asc" },
        take: 12,
      }),
      manager
        ? prisma.template.count({
            where: { versions: { some: { status: "PUBLISHED" } } },
          })
        : Promise.resolve(0),
      manager
        ? prisma.template.count({
            where: { versions: { some: { status: "DRAFT" } } },
          })
        : Promise.resolve(0),
      manager || user.role === "HR"
        ? prisma.seal.count({ where: { enabled: true } })
        : Promise.resolve(0),
      manager
        ? prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
            include: { user: { select: { fullName: true } } },
          })
        : Promise.resolve([]),
    ]);

    const myApprove = myApproveRows.filter((t) =>
      getCurrentSigners(t.flowType, t.signers).some((s) => s.userId === user.id),
    );
    const mySign = mySignRows.filter((t) =>
      getCurrentSigners(t.flowType, t.signers).some((s) => s.userId === user.id),
    );

    const mapTask = (t: (typeof recentRows)[number], reason: string) => ({
      id: t.id,
      title: t.title,
      reason,
      category: t.document.category,
      approvalStatus: t.approvalStatus,
      signingStatus: t.signingStatus,
      expiresAt: t.expiresAt?.toISOString() ?? null,
      updatedAt: t.updatedAt.toISOString(),
      creatorName: t.creator.fullName,
    });

    const attentionMap = new Map<string, ReturnType<typeof mapTask>>();
    for (const t of myApprove) attentionMap.set(t.id, mapTask(t, "approve"));
    for (const t of mySign) {
      if (!attentionMap.has(t.id)) attentionMap.set(t.id, mapTask(t, "sign"));
    }

    return NextResponse.json({
      user: { name: user.name, role: user.role },
      kpis: {
        myApprove: myApprove.length,
        mySign: mySign.length,
        pendingApprove,
        pendingSign,
        expiring7d,
        overdue,
        completed30d,
      },
      attention: Array.from(attentionMap.values()).slice(0, 8),
      recent: recentRows.map((t) => mapTask(t, "recent")),
      catalog: manager
        ? { templatesPublished, templatesDraft, sealsEnabled }
        : null,
      activity: activity.map((a) => ({
        id: a.id,
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        createdAt: a.createdAt.toISOString(),
        actorName: a.user?.fullName ?? null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

async function deptScope(userId: string): Promise<TaskScope> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });
  if (!me?.departmentId) {
    return {
      OR: [{ createdBy: userId }, { signers: { some: { userId } } }],
    };
  }
  return {
    OR: [
      { createdBy: userId },
      { signers: { some: { userId } } },
      { creator: { departmentId: me.departmentId } },
    ],
  };
}

export const runtime = "nodejs";
