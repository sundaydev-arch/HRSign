import { z } from "zod";

/**
 * Webhook events and payloads (spec 10).
 *
 * - Webhooks (HMAC signed): task created, approval result, signing completed,
 *   declined, expired
 * - The payload is stored in the WebhookDelivery.payload Json column
 * - Validated by zod; direct type assertions are forbidden
 */

export const WebhookEventSchema = z.enum([
  "task.created",
  "approval.result",
  "signing.completed",
  "signing.declined",
  "signing.expired",
]);

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export const WebhookPayloadSchema = z.object({
  event: WebhookEventSchema,
  taskId: z.string().optional(),
  documentId: z.string().optional(),
  /** ISO 8601 UTC. */
  timestamp: z.string(),
  /** Event-specific data; shape depends on the event type. */
  data: z.record(z.string(), z.unknown()).optional(),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
