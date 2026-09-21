/**
 * EmailNotifier — default Phase 1 Notifier (spec 2 / 20.1).
 *
 * Sends email over SMTP:
 *   - Multiple templates per locale (spec 20: NotificationTemplate).
 *   - ICU MessageFormat variable rendering (simple {var} substitution in
 *     Phase 1; full plural/select support is deferred to a complete ICU lib).
 *   - Exponential-backoff retries.
 *   - Every attempt is recorded in NotificationLog for auditing.
 *
 * Optional Phase 2 adapters (WeCom / DingTalk / Lark) are not built here.
 *
 * The module also exposes sendEmail(), a transport-level direct sender used
 * by the task-event notification service until database-backed templates are
 * fully wired.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import type { NotificationParams } from "@/schemas/notification";
import type { Locale, NotificationChannel, NotificationRecipient, Notifier } from "../types";

// Repository abstractions (keeps the provider decoupled from Prisma).
interface NotificationLogRepository {
  create(input: {
    taskId: string | null;
    recipientUserId: string | null;
    recipientEmail: string | null;
    recipientPhone: string | null;
    channel: NotificationChannel;
    templateKey: string;
    templateParams: unknown;
    subject: string | null;
    body: string | null;
    status: "PENDING";
    attemptCount: number;
  }): Promise<{ id: string }>;
  markSent(id: string, attemptCount: number): Promise<void>;
  markFailed(id: string, attemptCount: number, error: string): Promise<void>;
}

interface NotificationTemplateRepository {
  findByKeyChannelLocale(input: {
    key: string;
    channel: NotificationChannel;
    locale: Locale;
  }): Promise<{
    subject: string;
    body: string;
    defaultParams: Record<string, unknown> | null;
  } | null>;
}

export interface EmailNotifierDeps {
  transporter: Transporter<unknown>;
  from: string;
  /** Number of send attempts (default 3). */
  maxRetries?: number;
  /** Initial retry backoff in milliseconds (default 1000); exponential. */
  retryBaseMs?: number;
  logRepository: NotificationLogRepository;
  templateRepository: NotificationTemplateRepository;
}

/**
 * Minimal ICU MessageFormat renderer.
 *
 * Phase 1 supports simple {var} substitution only (spec 20.1 calls for ICU);
 * full plural/select support will use a complete Intl MessageFormat library
 * in Phase 2 (Chinese has no plural form; English plurals come then).
 */
export function renderIcu(template: string, params: NotificationParams): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

export class EmailNotifier implements Notifier {
  private readonly transporter: Transporter<unknown>;
  private readonly from: string;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly logRepository: NotificationLogRepository;
  private readonly templateRepository: NotificationTemplateRepository;

  constructor(deps: EmailNotifierDeps) {
    this.transporter = deps.transporter;
    this.from = deps.from;
    this.maxRetries = deps.maxRetries ?? 3;
    this.retryBaseMs = deps.retryBaseMs ?? 1000;
    this.logRepository = deps.logRepository;
    this.templateRepository = deps.templateRepository;
  }

  async send(input: {
    channel: NotificationChannel;
    recipient: NotificationRecipient;
    templateKey: string;
    params: NotificationParams;
    taskId: string | null;
  }): Promise<{
    notificationLogId: string;
    status: "SENT" | "FAILED" | "SKIPPED";
    error: string | null;
  }> {
    // 1. Channel check (EmailNotifier handles EMAIL only).
    if (input.channel !== "EMAIL") {
      const logId = await this.logRepository.create({
        taskId: input.taskId,
        recipientUserId: input.recipient.userId,
        recipientEmail: input.recipient.email,
        recipientPhone: input.recipient.phone,
        channel: input.channel,
        templateKey: input.templateKey,
        templateParams: input.params,
        subject: null,
        body: null,
        status: "PENDING",
        attemptCount: 0,
      });
      return {
        notificationLogId: logId.id,
        status: "SKIPPED",
        error: `EmailNotifier does not support channel ${input.channel}`,
      };
    }

    // 2. Load the template (spec 20: one row per locale).
    const template = await this.templateRepository.findByKeyChannelLocale({
      key: input.templateKey,
      channel: input.channel,
      locale: input.recipient.locale,
    });
    if (!template) {
      const logId = await this.logRepository.create({
        taskId: input.taskId,
        recipientUserId: input.recipient.userId,
        recipientEmail: input.recipient.email,
        recipientPhone: input.recipient.phone,
        channel: input.channel,
        templateKey: input.templateKey,
        templateParams: input.params,
        subject: null,
        body: null,
        status: "PENDING",
        attemptCount: 0,
      });
      return {
        notificationLogId: logId.id,
        status: "FAILED",
        error: `Notification template not found: key=${input.templateKey} locale=${input.recipient.locale}`,
      };
    }

    // 3. Render the template (defaults merged with caller params).
    // defaultParams comes from a Json column; keep only JSON primitive values
    // instead of type-asserting (spec 13.2).
    const defaults = Object.fromEntries(
      Object.entries(template.defaultParams ?? {}).filter(
        (entry): entry is [string, string | number | boolean | null] =>
          typeof entry[1] === "string" ||
          typeof entry[1] === "number" ||
          typeof entry[1] === "boolean" ||
          entry[1] === null,
      ),
    );
    const mergedParams: NotificationParams = {
      ...defaults,
      ...input.params,
    };
    const subject = renderIcu(template.subject, mergedParams);
    const body = renderIcu(template.body, mergedParams);

    // 4. Create a PENDING log row.
    const log = await this.logRepository.create({
      taskId: input.taskId,
      recipientUserId: input.recipient.userId,
      recipientEmail: input.recipient.email,
      recipientPhone: input.recipient.phone,
      channel: input.channel,
      templateKey: input.templateKey,
      templateParams: input.params,
      subject,
      body,
      status: "PENDING",
      attemptCount: 0,
    });

    // 5. Send via SMTP with retries.
    if (!input.recipient.email) {
      await this.logRepository.markFailed(log.id, 0, "Recipient email is empty");
      return {
        notificationLogId: log.id,
        status: "FAILED",
        error: "Recipient email is empty",
      };
    }

    let attemptCount = 0;
    let lastError = "";

    for (attemptCount = 1; attemptCount <= this.maxRetries; attemptCount++) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to: input.recipient.email,
          subject,
          text: body,
        });
        await this.logRepository.markSent(log.id, attemptCount);
        return {
          notificationLogId: log.id,
          status: "SENT",
          error: null,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // Exponential backoff: base * 2^(attempt-1).
        if (attemptCount < this.maxRetries) {
          const delay = this.retryBaseMs * Math.pow(2, attemptCount - 1);
          await sleep(delay);
        }
      }
    }

    await this.logRepository.markFailed(log.id, attemptCount - 1, lastError);
    return {
      notificationLogId: log.id,
      status: "FAILED",
      error: lastError,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Transport-level direct sender (used until DB templates are wired)
// ============================================================

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  taskId?: string | null;
}

function getTransport(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE !== "false";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

/**
 * Send an email directly and persist a NotificationLog row.
 * When SMTP is not configured the attempt is recorded as SKIPPED so that
 * notification failures never block the main business transaction.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const from = process.env.SMTP_FROM ?? "HRSign <hrsign@example.com>";
  const transport = getTransport();

  let status: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED";
  let error: string | null = null;
  let sentAt: Date | null = null;

  if (transport) {
    try {
      await transport.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      status = "SENT";
      sentAt = new Date();
    } catch (err) {
      status = "FAILED";
      error = err instanceof Error ? err.message : String(err);
      console.error("[notify] email send failed:", error);
    }
  }

  try {
    await prisma.notificationLog.create({
      data: {
        taskId: input.taskId ?? null,
        channel: "EMAIL",
        templateKey: "generic.email",
        recipientEmail: input.to,
        subject: input.subject,
        body: input.html,
        status,
        error,
        sentAt,
      },
    });
  } catch (err) {
    console.error("[notify] failed to persist notification log:", err);
  }
}
