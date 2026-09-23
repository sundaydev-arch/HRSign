/**
 * Single export surface for zod schemas (spec 13.2).
 *
 * Every Prisma Json column has a paired zod schema in code:
 * - TemplateField.coordinates         → coordinates.ts
 * - TemplateField.validationRules     → template-field.ts
 * - TemplateField.labelI18n           → label-i18n.ts
 * - TemplateVersion.watermarkConfig   → watermark.ts
 * - Document.fieldValues              → field-values.ts
 * - AuditLog.detail                   → audit-detail.ts
 * - WebhookDelivery.payload           → webhook-payload.ts
 * - NotificationLog.templateParams    → notification.ts
 * - NotificationTemplate.defaultParams → notification.ts
 * - Signature.verificationResult      → signature.ts
 */

export * from "./coordinates";
export * from "./template-field";
export * from "./label-i18n";
export * from "./watermark";
export * from "./field-values";
export * from "./audit-detail";
export * from "./webhook-payload";
export * from "./notification";
export * from "./signature";
export * from "./auth-forms";
export * from "./create-task";
