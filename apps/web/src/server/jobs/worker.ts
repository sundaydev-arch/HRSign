/**
 * pg-boss worker entry — run with: pnpm worker
 */

import { prisma } from "@/lib/prisma";
import { expireDueTasks } from "@/lib/tasks";
import {
  notifyTaskApproved,
  notifyTaskCompleted,
  notifyTaskCreated,
} from "@/server/notifications/task-events";
import { getStorage } from "@/server/providers";
import { retryWebhookDelivery } from "@/server/webhooks/dispatch";
import { startWorker, type JobName } from "./queue";
import { runRemindScan } from "./remind";
import { runRetentionScan } from "./retention";

async function main() {
  const boss = await startWorker();
  console.log("[worker] pg-boss started");

  await boss.work("notify.task_created", async ([job]) => {
    if (!job) return;
    const taskId = String((job.data as { taskId?: string }).taskId ?? "");
    if (taskId) await notifyTaskCreated(taskId);
  });

  await boss.work("notify.task_approved", async ([job]) => {
    if (!job) return;
    const taskId = String((job.data as { taskId?: string }).taskId ?? "");
    if (taskId) await notifyTaskApproved(taskId);
  });

  await boss.work("notify.task_completed", async ([job]) => {
    if (!job) return;
    const taskId = String((job.data as { taskId?: string }).taskId ?? "");
    if (taskId) await notifyTaskCompleted(taskId);
  });

  await boss.work("tasks.expire_scan", async () => {
    await expireDueTasks();
  });

  await boss.work("tasks.remind_scan", async () => {
    const r = await runRemindScan();
    console.log("[worker] remind_scan", r);
  });

  await boss.work("retention.scan", async () => {
    await runRetentionScan();
  });

  await boss.work("webhook.retry", async ([job]) => {
    if (!job) return;
    const deliveryId = String((job.data as { deliveryId?: string }).deliveryId ?? "");
    if (deliveryId) await retryWebhookDelivery(deliveryId);
  });

  await boss.schedule("tasks.expire_scan" as JobName, "0 * * * *", {});
  await boss.schedule("retention.scan" as JobName, "15 * * * *", {});
  await boss.schedule("tasks.remind_scan" as JobName, "0 9 * * *", {});

  console.log("[worker] handlers registered");

  const shutdown = async () => {
    console.log("[worker] shutting down");
    await boss.stop({ graceful: true, timeout: 10_000 });
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  try {
    getStorage();
  } catch {
    /* optional at boot */
  }
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
