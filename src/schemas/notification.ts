import { z } from "zod";

/**
 * Notification template parameters (spec 20.1).
 *
 * - Templates use ICU MessageFormat; these are the variables
 * - Stored in the NotificationLog.templateParams Json column
 * - No localized text is stored; the Notifier picks a template by locale at
 *   render time
 */
export const NotificationParamsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export type NotificationParams = z.infer<typeof NotificationParamsSchema>;

/** Default notification template parameters (NotificationTemplate.defaultParams). */
export const NotificationDefaultParamsSchema = NotificationParamsSchema;

export type NotificationDefaultParams = z.infer<
  typeof NotificationDefaultParamsSchema
>;
