/**
 * Task lifecycle notification service.
 *
 * External signers get short links (/s/{code}) resolved from SigningToken.shortCode
 * so approve/seal re-notifications stay valid without an in-memory token map.
 */

import { DEFAULT_LOCALE, toAppLocale, type AppLocale } from "@/i18n/config";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getActiveSigningUrl, issueSigningShortLink } from "@/lib/signing-links";
import { getCurrentSigners } from "@/lib/tasks";
import { fanOutChannels } from "@/server/providers/notify/channels";
import type { Signer, UserLocale } from "@prisma/client";

const appUrl = env.APP_URL;

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
  withdrawnSubject: string;
  revokedSubject: string;
  declinedSubject: string;
  completedSubject: string;
  noReason: string;
  taskMeta: (creatorName: string) => string;
  rejectedReason: (reason: string) => string;
  rejectedLine: (taskTitle: string) => string;
  withdrawnLine: (taskTitle: string) => string;
  revokedLine: (taskTitle: string) => string;
  declinedLine: (taskTitle: string) => string;
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
    withdrawnSubject: "【HRSign】签署任务已撤回",
    revokedSubject: "【HRSign】签署任务已作废",
    declinedSubject: "【HRSign】签署方拒绝签署",
    completedSubject: "【HRSign】签署任务已完成",
    noReason: "无",
    taskMeta: (creatorName) => `（发起人：${creatorName}），请您及时处理。`,
    rejectedReason: (reason) => `驳回意见：${reason}`,
    rejectedLine: (taskTitle) => `任务 <b>${taskTitle}</b> 已被驳回。`,
    withdrawnLine: (taskTitle) => `任务 <b>${taskTitle}</b> 已由发起人撤回。`,
    revokedLine: (taskTitle) => `任务 <b>${taskTitle}</b> 已被作废，签署链接已失效。`,
    declinedLine: (taskTitle) => `任务 <b>${taskTitle}</b> 有签署方拒绝签署。`,
    completedLine: (taskTitle) =>
      `任务 <b>${taskTitle}</b> 所有参与方已签署完成，文档已自动归档。`,
  },
  en: {
    footer:
      "This email was sent by the HRSign HR e-Sign &amp; Sealing system. Please do not reply directly.",
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
    withdrawnSubject: "[HRSign] A signing task was withdrawn",
    revokedSubject: "[HRSign] A signing task was revoked",
    declinedSubject: "[HRSign] A signer declined to sign",
    completedSubject: "[HRSign] Signing task completed",
    noReason: "None",
    taskMeta: (creatorName) => ` (Initiator: ${creatorName}). Please handle it promptly.`,
    rejectedReason: (reason) => `Rejection reason: ${reason}`,
    rejectedLine: (taskTitle) => `Task <b>${taskTitle}</b> has been rejected.`,
    withdrawnLine: (taskTitle) => `Task <b>${taskTitle}</b> was withdrawn by the initiator.`,
    revokedLine: (taskTitle) =>
      `Task <b>${taskTitle}</b> was revoked. Signing links are no longer valid.`,
    declinedLine: (taskTitle) => `A signer declined task <b>${taskTitle}</b>.`,
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
  return `<a href="${href}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:8px 20px;border-radius:6px;font-size:14px;">${text}</a>`;
}

async function deliverNotify(
  to: string,
  subject: string,
  html: string,
  taskId: string,
  plainExtra?: string,
): Promise<void> {
  await fanOutChannels({
    text: plainExtra ? `${subject}\n${plainExtra}` : subject,
    email: { to, subject, html, taskId },
  });
}

async function signerLink(
  signer: Signer & { task?: { expiresAt: Date | null } },
  taskId: string,
): Promise<string> {
  if (signer.externalEmail) {
    let url = await getActiveSigningUrl(signer.id);
    if (!url) {
      const issued = await issueSigningShortLink({
        signerId: signer.id,
        expiresAt: signer.task?.expiresAt,
      });
      url = issued.url;
    }
    return url;
  }
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

async function notifyActiveSigners(taskId: string, event: ActiveSignerEvent): Promise<void> {
  const task = await loadTask(taskId);
  if (!task) return;
  for (const signer of getCurrentSigners(task.flowType, task.signers)) {
    const to = signer.externalEmail ?? signer.user?.email;
    if (!to) continue;
    const locale = resolveLocale(signer.user?.locale);
    const copy = EMAIL_COPY[locale];
    const subject =
      event === "created"
        ? copy.createdSubject
        : event === "approve"
          ? copy.approveSubject
          : copy.signSubject;
    const intro =
      event === "created" ? copy.createdIntro : event === "approve" ? copy.approveIntro : copy.signIntro;
    const actionText = signer.signRole === "APPROVER" ? copy.approveAction : copy.signAction;
    const creatorName = task.creatorName ?? copy.unknownCreator;
    const href = await signerLink({ ...signer, task: { expiresAt: task.expiresAt } }, taskId);
    const html = pageStyle(
      locale,
      subject,
      `<p>${intro}</p>
       <p><b>${task.title}</b>${copy.taskMeta(creatorName)}</p>
       ${linkHtml(actionText, href)}`,
    );
    await deliverNotify(to, subject, html, taskId, `${task.title}\n${href}`);
  }
}

export async function notifyTaskCreated(taskId: string): Promise<void> {
  await notifyActiveSigners(taskId, "created");
}

export async function notifyTaskApproved(taskId: string): Promise<void> {
  const task = await loadTask(taskId);
  if (!task) return;
  const stillApproval = task.signers.some(
    (signer) => signer.signRole === "APPROVER" && signer.status === "PENDING",
  );
  await notifyActiveSigners(taskId, stillApproval ? "approve" : "sign");
}

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
  await deliverNotify(creatorEmail.email, copy.rejectedSubject, html, taskId, task.title);
}

async function emailCreator(
  taskId: string,
  build: (task: NonNullable<Awaited<ReturnType<typeof loadTask>>>, locale: AppLocale, copy: EmailCopy) => {
    subject: string;
    html: string;
  },
): Promise<void> {
  const task = await loadTask(taskId);
  if (!task) return;
  const creatorEmail = await prisma.user.findUnique({
    where: { id: task.createdBy },
    select: { email: true },
  });
  if (!creatorEmail?.email) return;
  const locale = resolveLocale(task.creatorLocale);
  const copy = EMAIL_COPY[locale];
  const { subject, html } = build(task, locale, copy);
  await deliverNotify(creatorEmail.email, subject, html, taskId, task.title);
}

async function emailTaskParticipants(
  taskId: string,
  build: (task: NonNullable<Awaited<ReturnType<typeof loadTask>>>, locale: AppLocale, copy: EmailCopy) => {
    subject: string;
    html: string;
  },
): Promise<void> {
  const task = await loadTask(taskId);
  if (!task) return;
  const seen = new Set<string>();
  for (const signer of task.signers) {
    const to = signer.externalEmail ?? signer.user?.email;
    if (!to || seen.has(to)) continue;
    seen.add(to);
    const locale = resolveLocale(signer.user?.locale ?? task.creatorLocale);
    const copy = EMAIL_COPY[locale];
    const { subject, html } = build(task, locale, copy);
    await deliverNotify(to, subject, html, taskId, task.title);
  }
}

export async function notifyTaskWithdrawn(taskId: string): Promise<void> {
  await emailCreator(taskId, (task, locale, copy) => ({
    subject: copy.withdrawnSubject,
    html: pageStyle(locale, copy.withdrawnSubject, `<p>${copy.withdrawnLine(task.title)}</p>`),
  }));
  await emailTaskParticipants(taskId, (task, locale, copy) => ({
    subject: copy.withdrawnSubject,
    html: pageStyle(locale, copy.withdrawnSubject, `<p>${copy.withdrawnLine(task.title)}</p>`),
  }));
}

export async function notifyTaskRevoked(taskId: string): Promise<void> {
  await emailCreator(taskId, (task, locale, copy) => ({
    subject: copy.revokedSubject,
    html: pageStyle(locale, copy.revokedSubject, `<p>${copy.revokedLine(task.title)}</p>`),
  }));
  await emailTaskParticipants(taskId, (task, locale, copy) => ({
    subject: copy.revokedSubject,
    html: pageStyle(locale, copy.revokedSubject, `<p>${copy.revokedLine(task.title)}</p>`),
  }));
}

export async function notifyTaskDeclined(taskId: string, reason: string | null): Promise<void> {
  await emailCreator(taskId, (task, locale, copy) => ({
    subject: copy.declinedSubject,
    html: pageStyle(
      locale,
      copy.declinedSubject,
      `<p>${copy.declinedLine(task.title)}</p><p>${copy.rejectedReason(reason || copy.noReason)}</p>`,
    ),
  }));
}

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
  await deliverNotify(creatorEmail.email, copy.completedSubject, html, taskId, task.title);
}

/** Resend the current-turn email to one signer (external short link or internal task). */
export async function resendSignerNotification(taskId: string, signerId: string): Promise<void> {
  const task = await loadTask(taskId);
  if (!task) return;
  const signer = task.signers.find((s) => s.id === signerId);
  if (!signer) return;
  const to = signer.externalEmail ?? signer.user?.email;
  if (!to) return;
  const locale = resolveLocale(signer.user?.locale);
  const copy = EMAIL_COPY[locale];
  const stillApproval = task.signers.some(
    (s) => s.signRole === "APPROVER" && s.status === "PENDING",
  );
  const event: ActiveSignerEvent =
    task.signingStatus === "NOT_STARTED" && stillApproval ? "approve" : "sign";
  const subject = event === "approve" ? copy.approveSubject : copy.signSubject;
  const intro = event === "approve" ? copy.approveIntro : copy.signIntro;
  const actionText = signer.signRole === "APPROVER" ? copy.approveAction : copy.signAction;
  const href = await signerLink({ ...signer, task: { expiresAt: task.expiresAt } }, taskId);
  const html = pageStyle(
    locale,
    subject,
    `<p>${intro}</p>
     <p><b>${task.title}</b>${copy.taskMeta(task.creatorName ?? copy.unknownCreator)}</p>
     ${linkHtml(actionText, href)}`,
  );
  await deliverNotify(to, subject, html, taskId, `${task.title}\n${href}`);
}
