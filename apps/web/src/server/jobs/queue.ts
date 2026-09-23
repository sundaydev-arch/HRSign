import { env } from "@/lib/env";
import PgBoss from "pg-boss";

export type JobName =
  | "notify.task_created"
  | "notify.task_approved"
  | "notify.task_completed"
  | "tasks.expire_scan"
  | "tasks.remind_scan"
  | "retention.scan"
  | "webhook.retry";

let bossSingleton: PgBoss | null = null;
let startPromise: Promise<PgBoss> | null = null;

async function getBoss(): Promise<PgBoss | null> {
  try {
    if (bossSingleton) return bossSingleton;
    if (!startPromise) {
      startPromise = (async () => {
        const boss = new PgBoss(env.DATABASE_URL_WORKER ?? env.DATABASE_URL);
        boss.on("error", (err) => console.error("[pg-boss]", err));
        await boss.start();
        for (const name of [
          "notify.task_created",
          "notify.task_approved",
          "notify.task_completed",
          "tasks.expire_scan",
          "tasks.remind_scan",
          "retention.scan",
          "webhook.retry",
        ] as JobName[]) {
          await boss.createQueue(name);
        }
        bossSingleton = boss;
        return boss;
      })();
    }
    return await startPromise;
  } catch (err) {
    console.warn("[pg-boss] unavailable, jobs will run inline or skip:", err);
    startPromise = null;
    return null;
  }
}

export async function enqueueJob(name: JobName, data: Record<string, unknown>): Promise<string | null> {
  const boss = await getBoss();
  if (!boss) return null;
  const id = await boss.send(name, data);
  return id;
}

export async function startWorker(): Promise<PgBoss> {
  const boss = await getBoss();
  if (!boss) throw new Error("pg-boss failed to start");
  return boss;
}

export { getBoss };
