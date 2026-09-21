/**
 * Task lifecycle notification service.
 *
 * Composes task-event emails (created / approved / rejected / completed) and
 * delivers them through the concrete mail transport (sendEmail). This is an
 * orchestration layer: it may query Prisma and know about SigningTask, while
 * the Notifier provider stays generic.
 *
 * Localization (spec 20.1): copy ships as in-code zh-CN/en dictionaries and is
 * chosen per recipient — the recipient's user locale, falling back to the
 * default locale for external signers without an account.
 */

import { DEFAULT_LOCALE, toAppLocale, type AppLocale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { getCurrentSigners } from "@/lib/tasks";
import { sendEmail } from "@/server/providers";
import type { Signer, UserLocale } from "@prisma/client";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

interface EmailCopy {
  footer: string;
  unknownCreator: string;
  approveAction: string;
  signAction: string;
  viewArchiveAction: string;
  createdSubject: string;
  createdIntro: string;
  approveSubject: string;
  approveIntro: string;
  signSubject: string;
  signIntro: string;
  rejectedSubject: string;
  completedSubject: string;
  noReason: string;
  /** "(Initiator: X), please handle it promptly." — appended after the title. */
  taskMeta: (creatorName: string) => string;
  rejectedReason: (reason: string) => string;
  rejectedLine: (taskTitle: string) => string;
  completedLine: (taskTitle: string) => string;
}

const EMAIL_COPY: Record<AppLocale, EmailCopy> = {
  "zh-CN": {
    footer: "本邮件由 HRSign 人事电子签章系统发送，请勿直接回复。",
    unknownCreator: "未知",
    approveAction: "前往审批",
    signAction: "前往签署",
    viewArchiveAction: "查看归档文档",
    createdSubject: "【HRSign】您有新的签署任务待处理",
    createdIntro: "您有一份新的签署任务需要处理：",
    approveSubject: "【HRSign】签署任务待您审批",
    approveIntro: "上一级审批已通过，轮到您审批：",
    signSubject: "【HRSign】签署任务待您签署",
    signIntro: "任务已完成审批，请您签署：",
    rejectedSubject: "【HRSign】签署任务被驳回",
    completedSubject: "【HRSign】签署任务已完成",
    noReason: "无",
    taskMeta: (creatorName) => `（发起人：${creatorName}），请您及时处理。`,
    rejectedReason: (reason) => `驳回意见：${reason}`,
    rejectedLine: (taskTitle) => `任务 <b>${taskTitle}</b> 已被驳回。`,
    completedLine: (taskTitle) => `任务 <b>${taskTitle}</b> 所有参与方已签署完成，文档已自动归档。`,
  },
  en: {
    footer: "This email was sent by the HRSign HR e-Sign &amp; Sealing system. Please do not reply directly.",
    unknownCreator: "Unknown",
    approveAction: "Go to Approval",
    signAction: "Go to Signing",
    viewArchiveAction: "View Archived Document",
    createdSubject: "[HRSign] You have a new signing task",
    createdIntro: "You have a new signing task to process:",
    approveSubject: "[HRSign] A signing task is awaiting your approval",
    approveIntro: "The previous approval has passed. It is now your turn to approve:",
    signSubject: "[HRSign] A signing task is awaiting your signature",
    signIntro: "Approval is complete. Please sign the task:",
    rejectedSubject: "[HRSign] A signing task was rejected",
    completedSubject: "[HRSign] Signing task completed",
    noReason: "None",
    taskMeta: (creatorName) => ` (Initiator: ${creatorName}). Please handle it promptly.`,
    rejectedReason: (reason) => `Rejection reason: ${reason}`,
    rejectedLine: (taskTitle) => `Task <b>${taskTitle}</b> has been rejected.`,
    completedLine: (taskTitle) =>
      `All parties have signed task <b>${taskTitle}</b>. The document has been archived automatically.`,
  },
};

function resolveLocale(locale: UserLocale | null | undefined): AppLocale {
  return locale ? toAppLocale(locale) : DEFAULT_LOCALE;
}

function pageStyle(locale: AppLocale, title: string, body: string): string {
  return `
  <div style="max-width:560px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#1f2937;">
    <h2 style="font-size:18px;font-weight:600;">${title}</h2>
    <div style="font-size:14px;line-height:1.8;">${body}</div>
    <p style="font-size:12px;color:#9ca3af;margin-top:24px;">${EMAIL_COPY[locale].footer}</p>
  </div>`;
}

function linkHtml(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:8px 20px;border-radius:6px;font-size:14px;">${text}</a>`;
}

/**
 * Build the action link for a signer.
 *
 * SigningToken only stores a hash (spec 4), so the plaintext cannot be
 * recovered from the database:
 *   - At task creation, the plaintext token is passed via externalTokenMap to
 *     build the external signing link.
 *   - Without a mapping (e.g. re-notification after approval) the internal
 *     task link is used. Known Phase 1 limitation: external signers must use
 *     the original link from the creation email.
 */
function signerLink(signer: Signer, taskId: string, externalTokenMap?: Map<string, string>): string {
  const token = externalTokenMap?.get(signer.id);
  if (token) return `${appUrl}/sign/external/${token}`;
  return `${appUrl}/tasks/${taskId}`;
}

async function loadTask(taskId: string) {
  const task = await prisma.signingTask.findUnique({
    where: { id: taskId },
    include: {
      signers: { include: { user: { select: { fullName: true, email: true, locale: true } } } },
    },
  });
  if (!task) return null;
  const creator = await prisma.user.findUnique({
    where: { id: task.createdBy },
    select: { fullName: true, locale: true },
  });
  return { ...task, creatorName: creator?.fullName ?? null, creatorLocale: creator?.locale };
}

type ActiveSignerEvent = "created" | "approve" | "sign";

async function notifyActiveSigners(
  taskId: string,
  event: ActiveSignerEvent,
  externalTokenMap?: Map<string, string>,
): Promise<void> {
  const task = await loadTask(taskId);
  if (!task) return;
  for (const signer of getCurrentSigners(task.flowType, task.signers)) {
    const to = signer.externalEmail ?? signer.user?.email;
    if (!to) continue;
    // External signers have no account, so they fall back to the default locale.
    const locale = resolveLocale(signer.user?.locale);
    const copy = EMAIL_COPY[locale];
    const subject =
      event === "created" ? copy.createdSubject : event === "approve" ? copy.approveSubject : copy.signSubject;
    const intro = event === "created" ? copy.createdIntro : event === "approve" ? copy.approveIntro : copy.signIntro;
    const actionText = signer.signRole === "APPROVER" ? copy.approveAction : copy.signAction;
    const creatorName = task.creatorName ?? copy.unknownCreator;
    const html = pageStyle(
      locale,
      subject,
      `<p>${intro}</p>
       <p><b>${task.title}</b>${copy.taskMeta(creatorName)}</p>
       ${linkHtml(actionText, signerLink(signer, taskId, externalTokenMap))}`,
    );
    await sendEmail({ to, subject, html, taskId });
  }
}

/** Task created: notify the first active approvers/signers. The map carries plaintext tokens for external signers (signerId → token). */
export async function notifyTaskCreated(taskId: string, externalTokenMap?: Map<string, string>): Promise<void> {
  await notifyActiveSigners(taskId, "created", externalTokenMap);
}

/** Approval passed: notify the next approver, or active signers once approval is complete. */
export async function notifyTaskApproved(taskId: string): Promise<void> {
  const task = await loadTask(taskId);
  if (!task) return;
  const stillApproval = task.signers.some((signer) => signer.signRole === "APPROVER" && signer.status === "PENDING");
  await notifyActiveSigners(taskId, stillApproval ? "approve" : "sign");
}

/** Task rejected: notify the initiator. */
export async function notifyTaskRejected(taskId: string, reason: string | null): Promise<void> {
  const task = await loadTask(taskId);
  if (!task) return;
  const creatorEmail = await prisma.user.findUnique({
    where: { id: task.createdBy },
    select: { email: true },
  });
  if (!creatorEmail) return;
  const locale = resolveLocale(task.creatorLocale);
  const copy = EMAIL_COPY[locale];
  const reasonLine = copy.rejectedReason(reason || copy.noReason);
  const html = pageStyle(
    locale,
    copy.rejectedSubject,
    `<p>${copy.rejectedLine(task.title)}</p><p>${reasonLine}</p>`,
  );
  await sendEmail({
    to: creatorEmail.email,
    subject: copy.rejectedSubject,
    html,
    taskId,
  });
}

/** Signing completed: notify the initiator. */
export async function notifyTaskCompleted(taskId: string): Promise<void> {
  const task = await loadTask(taskId);
  if (!task) return;
  const creatorEmail = await prisma.user.findUnique({
    where: { id: task.createdBy },
    select: { email: true },
  });
  if (!creatorEmail) return;
  const locale = resolveLocale(task.creatorLocale);
  const copy = EMAIL_COPY[locale];
  const html = pageStyle(
    locale,
    copy.completedSubject,
    `<p>${copy.completedLine(task.title)}</p>
     ${linkHtml(copy.viewArchiveAction, `${appUrl}/archive`)}`,
  );
  await sendEmail({
    to: creatorEmail.email,
    subject: copy.completedSubject,
    html,
    taskId,
  });
}
