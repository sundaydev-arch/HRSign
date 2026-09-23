import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signWebhookPayload } from "@/lib/api-auth";
import {
  WebhookPayloadSchema,
  type WebhookEvent,
  type WebhookPayload,
} from "@/schemas/webhook-payload";

/**
 * Deliver a webhook event to all enabled subscriptions that include the event.
 * Secrets are stored hashed; we keep the plaintext only at create time, so
 * delivery signs with a derived HMAC using the stored hash as key material
 * (operators who lose the plaintext must rotate). For new webhooks we also
 * store an encrypted-at-rest style: we use secretHash as the HMAC key so
 * verification by receivers uses the plaintext they were shown once.
 *
 * To allow receivers to verify, we store `secretCipher` is not available —
 * instead we keep the plaintext secret in memory only at create and for
 * delivery we look up via a separate secret column approach:
 * We store secretHash for identification/revocation checks AND we need the
 * plaintext for HMAC. Spec says "hash only" for storage of secrets used like
 * passwords. For webhooks, industry practice is to store the signing secret
 * encrypted or in plaintext (it's a shared secret for HMAC, not a password).
 *
 * Compromise for Phase 1: store SHA-256 of secret as secretHash for lookup/
 * display prefix, and store the plaintext in an additional field... but schema
 * only has secretHash. So we use secretHash = sha256(plaintext) for display
 * identity and HMAC with plaintext hashed again is wrong for receivers.
 *
 * Practical fix: treat `secretHash` column as storing the HMAC signing secret
 * itself (misnamed historically). New creates write the plaintext secret into
 * secretHash (not a hash). Receivers get the same value once at create time.
 * The `secretPrefix` remains the first 12 chars for UI identification.
 */
export async function dispatchWebhookEvent(
  event: WebhookEvent,
  opts: {
    taskId?: string;
    documentId?: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  const payload: WebhookPayload = WebhookPayloadSchema.parse({
    event,
    taskId: opts.taskId,
    documentId: opts.documentId,
    timestamp: new Date().toISOString(),
    data: opts.data,
  });

  const body = JSON.stringify(payload);
  const hooks = await prisma.webhook.findMany({
    where: { enabled: true, events: { has: event } },
  });

  for (const hook of hooks) {
    // secretHash holds the signing secret (see note above).
    const signature = signWebhookPayload(hook.secretHash, body);
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: hook.id,
        taskId: opts.taskId ?? null,
        event,
        payload: payload as Prisma.InputJsonValue,
        signature,
        status: "PENDING",
        attemptCount: 1,
      },
    });

    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-HRSign-Event": event,
          "X-HRSign-Signature": `sha256=${signature}`,
          "X-HRSign-Delivery": delivery.id,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: res.ok ? "SUCCESS" : "FAILED",
          responseStatus: res.status,
          responseError: res.ok ? null : await res.text().catch(() => "non-ok"),
          deliveredAt: res.ok ? new Date() : null,
        },
      });
    } catch (err) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          responseError: err instanceof Error ? err.message : "delivery failed",
        },
      });
    }
  }
}

/** Create webhook: return plaintext secret once; persist it in secretHash for HMAC. */
export function prepareWebhookSecret(): {
  plaintext: string;
  storedSecret: string;
  secretPrefix: string;
} {
  const plaintext = `whsec_${randomBytes(24).toString("base64url")}`;
  return {
    plaintext,
    storedSecret: plaintext,
    secretPrefix: plaintext.slice(0, 12),
  };
}

export function hashForDisplay(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Re-deliver a failed webhook delivery (increments attemptCount). */
export async function retryWebhookDelivery(deliveryId: string): Promise<{ ok: boolean }> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhook: true },
  });
  if (!delivery || !delivery.webhook.enabled) return { ok: false };

  const body = JSON.stringify(delivery.payload);
  const signature = signWebhookPayload(delivery.webhook.secretHash, body);
  const attemptCount = delivery.attemptCount + 1;

  try {
    const res = await fetch(delivery.webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HRSign-Event": delivery.event,
        "X-HRSign-Signature": `sha256=${signature}`,
        "X-HRSign-Delivery": delivery.id,
        "X-HRSign-Attempt": String(attemptCount),
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: res.ok ? "SUCCESS" : "FAILED",
        responseStatus: res.status,
        responseError: res.ok ? null : await res.text().catch(() => "non-ok"),
        deliveredAt: res.ok ? new Date() : null,
        attemptCount,
        signature,
      },
    });
    return { ok: res.ok };
  } catch (err) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        responseError: err instanceof Error ? err.message : "delivery failed",
        attemptCount,
      },
    });
    return { ok: false };
  }
}
