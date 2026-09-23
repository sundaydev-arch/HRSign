import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/server/providers";

/** Dev / stub SMS: logs body and writes NotificationLog (channel SMS). */
export async function sendSms(input: {
  to: string;
  body: string;
  templateKey?: string;
}): Promise<{ status: "SENT" | "FAILED" | "SKIPPED"; error: string | null }> {
  const provider = process.env.SMS_PROVIDER ?? "log";
  let status: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED";
  let error: string | null = null;
  let sentAt: Date | null = null;

  if (provider === "log" || provider === "dev") {
    console.info(`[sms] to=${input.to} body=${input.body}`);
    status = "SENT";
    sentAt = new Date();
  } else if (provider === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) {
      status = "FAILED";
      error = "TWILIO_NOT_CONFIGURED";
    } else {
      try {
        const auth = Buffer.from(`${sid}:${token}`).toString("base64");
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: input.to, From: from, Body: input.body }),
          },
        );
        if (!res.ok) {
          status = "FAILED";
          error = `TWILIO_HTTP_${res.status}`;
        } else {
          status = "SENT";
          sentAt = new Date();
        }
      } catch (err) {
        status = "FAILED";
        error = err instanceof Error ? err.message : String(err);
      }
    }
  } else {
    status = "SKIPPED";
    error = `UNKNOWN_SMS_PROVIDER:${provider}`;
  }

  try {
    await prisma.notificationLog.create({
      data: {
        channel: "SMS",
        templateKey: input.templateKey ?? "generic.sms",
        recipientEmail: null,
        recipientPhone: input.to,
        subject: null,
        body: input.body,
        status,
        error,
        sentAt,
      },
    });
  } catch (err) {
    console.error("[notify] failed to persist SMS log:", err);
  }

  return { status, error };
}

export async function deliverEnvelopeInvites(input: {
  envelopeId: string;
  subject: string;
  emailBlurb: string | null;
  recipients: Array<{
    id: string;
    name: string;
    email: string;
    phoneE164: string | null;
    deliveryChannel: string;
    recipientType: string;
    accessUrl: string | null;
  }>;
  appBaseUrl: string;
}): Promise<void> {
  for (const r of input.recipients) {
    if (!r.accessUrl) continue;
    const absolute = r.accessUrl.startsWith("http")
      ? r.accessUrl
      : `${input.appBaseUrl.replace(/\/$/, "")}${r.accessUrl}`;
    const channel = (r.deliveryChannel || "email").toLowerCase();
    const wantsEmail = channel === "email" || channel === "both";
    const wantsSms = channel === "sms" || channel === "both";

    if (wantsEmail) {
      const isInPerson = r.recipientType === "inPersonSigner";
      const subject = isInPerson
        ? `[In-person] ${input.subject}`
        : `Please sign: ${input.subject}`;
      const html = `
        <p>Hi ${escapeHtml(r.name)},</p>
        <p>${escapeHtml(input.emailBlurb || "You have a document to review and sign.")}</p>
        ${
          isInPerson
            ? `<p>This is an <strong>in-person</strong> signing session. Share this link with the host when you are ready.</p>`
            : ""
        }
        <p><a href="${absolute}">Open signing session</a></p>
        <p style="color:#666;font-size:12px">${absolute}</p>
      `;
      void sendEmail({ to: r.email, subject, html });
    }

    if (wantsSms && r.phoneE164) {
      void sendSms({
        to: r.phoneE164,
        body: `HRSign: ${input.subject} — ${absolute}`,
        templateKey: "envelope.invite.sms",
      });
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
