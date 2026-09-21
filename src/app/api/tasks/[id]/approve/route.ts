import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import { expireDueTasks, getCurrentSigners } from "@/lib/tasks";
import { notifyTaskApproved } from "@/server/notifications/task-events";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireApiUser();
    await expireDueTasks();

    const body = (await req.json().catch(() => ({}))) as { comment?: string };
    const comment = body.comment?.trim() || null;

    const task = await prisma.signingTask.findUnique({
      where: { id },
      include: { signers: true },
    });
    if (!task) throw new ApiError(404, "TASK_NOT_FOUND");
    if (task.approvalStatus !== "PENDING") throw new ApiError(400, "TASK_NOT_PENDING_APPROVAL");

    const me = task.signers.find(
      (s) => s.userId === user.id && s.signRole === "APPROVER" && s.status === "PENDING",
    );
    if (!me) throw new ApiError(403, "NOT_TASK_APPROVER");
    if (!getCurrentSigners(task.flowType, task.signers).some((s) => s.id === me.id)) {
      throw new ApiError(403, "NOT_YOUR_TURN");
    }

    await prisma.$transaction(async (tx) => {
      // Approver sign-off: Signer state machine PENDING → SIGNED.
      await tx.signer.update({
        where: { id: me.id },
        data: { status: "SIGNED", signedAt: new Date() },
      });
      // spec 15: ApprovalRecord captures the approval status transition.
      await tx.approvalRecord.create({
        data: {
          taskId: task.id,
          approverId: user.id,
          action: "APPROVE",
          fromStatus: task.approvalStatus,
          toStatus: "APPROVED",
          comment,
          ip: getClientIp(req),
          userAgent: getUserAgent(req),
        },
      });
      const remainingApprovers = await tx.signer.count({
        where: { taskId: task.id, signRole: "APPROVER", status: "PENDING" },
      });
      // spec 3.3: once all approvals pass, the signing state machine enters IN_PROGRESS.
      if (remainingApprovers === 0) {
        await tx.signingTask.update({
          where: { id: task.id },
          data: { approvalStatus: "APPROVED", signingStatus: "IN_PROGRESS" },
        });
      }
    });

    await recordAudit({
      userId: user.id,
      action: "task.approve",
      targetType: "task",
      targetId: task.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: { comment },
    });
    await notifyTaskApproved(task.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
