import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { expireDueTasks } from "@/lib/tasks";
import { notifyTaskRevoked } from "@/server/notifications/task-events";
import { canTransitionSigning } from "@/server/state-machines/signing";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

function canManageTask(user: { id: string; role: string }, task: { createdBy: string }): boolean {
  return user.role === "SUPER_ADMIN" || user.role === "HR" || task.createdBy === user.id;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireApiUser();
    await expireDueTasks();

    const task = await prisma.signingTask.findUnique({ where: { id } });
    if (!task) throw new ApiError(404, "TASK_NOT_FOUND");
    if (!canManageTask(user, task)) throw new ApiError(403, "FORBIDDEN");
    if (!canTransitionSigning(task.signingStatus, "REVOKED")) {
      throw new ApiError(400, "TASK_NOT_SIGNABLE");
    }

    await prisma.$transaction([
      prisma.signingTask.update({
        where: { id: task.id },
        data: { signingStatus: "REVOKED" },
      }),
      prisma.signingToken.updateMany({
        where: {
          revokedAt: null,
          signer: { taskId: task.id },
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    await recordAudit({
      userId: user.id,
      action: "task.revoke",
      targetType: "task",
      targetId: task.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    await notifyTaskRevoked(task.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
