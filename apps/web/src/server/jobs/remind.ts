import { prisma } from "@/lib/prisma";
import { loadAppSettings } from "@/lib/app-settings";
import { fanOutChannels } from "@/server/providers/notify/channels";
import { env } from "@/lib/env";

/**
 * Daily催签: pending signers on IN_PROGRESS tasks within remindDaysBefore of expiry (or overdue).
 */
export async function runRemindScan(): Promise<{ reminded: number }> {
  const settings = await loadAppSettings();
  const days = Math.max(0, settings.remindDaysBefore);
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const tasks = await prisma.signingTask.findMany({
    where: {
      signingStatus: "IN_PROGRESS",
      approvalStatus: "APPROVED",
      expiresAt: { lte: horizon },
    },
    include: {
      signers: {
        where: { status: "PENDING" },
        include: { user: { select: { email: true } } },
      },
    },
    take: 200,
  });

  let reminded = 0;
  const appUrl = env.APP_URL.replace(/\/$/, "");

  for (const task of tasks) {
    for (const signer of task.signers) {
      const email = signer.externalEmail ?? signer.user?.email ?? null;
      const link = `${appUrl}/tasks/${task.id}`;
      const subject = `[HRSign] Reminder: ${task.title}`;
      const expiresLabel = task.expiresAt ? task.expiresAt.toISOString() : "n/a";
      const body = `Pending signature for "${task.title}". Expires ${expiresLabel}. Open: ${link}`;

      await fanOutChannels({
        text: body,
        email: email
          ? { to: email, subject, html: `<p>${body}</p>`, taskId: task.id }
          : undefined,
      });
      reminded += 1;
    }
  }
  return { reminded };
}
