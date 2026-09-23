/** Audit log action codes emitted via `recordAudit({ action: "..." })`. */
export const AUDIT_ACTIONS = [
  "api_key.create",
  "api_key.revoke",
  "api_key.delete",
  "auth.invite.accept",
  "auth.password.reset",
  "document.legal_hold.off",
  "document.legal_hold.on",
  "retention.hard_delete",
  "retention.soft_delete",
  "seal.create",
  "seal.update",
  "settings.update",
  "signer.link.regenerate",
  "signer.link.resend",
  "task.approve",
  "task.create",
  "task.decline",
  "task.reject",
  "task.revoke",
  "task.sign",
  "task.withdraw",
  "template.archive",
  "template.create",
  "template.delete",
  "template.document.update",
  "template.fields.update",
  "template.update",
  "template.version.create",
  "user.create",
  "user.invite",
  "user.update",
  "webhook.create",
  "webhook.delete",
  "webhook.update",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Filter groups for the audit log UI (prefix / multi-prefix match). */
export const AUDIT_ACTION_GROUPS = [
  { id: "task", prefixes: ["task."] },
  { id: "template", prefixes: ["template."] },
  { id: "seal", prefixes: ["seal."] },
  { id: "signer", prefixes: ["signer."] },
  { id: "archive", prefixes: ["document.", "retention."] },
  { id: "account", prefixes: ["user.", "auth."] },
  { id: "admin", prefixes: ["api_key.", "webhook.", "settings."] },
] as const;

export type AuditActionGroupId = (typeof AUDIT_ACTION_GROUPS)[number]["id"];

export function auditActionGroupPrefixes(groupId: string): string[] | null {
  const group = AUDIT_ACTION_GROUPS.find((g) => g.id === groupId);
  return group ? [...group.prefixes] : null;
}

/** Maps dotted action codes to i18n keys under `auditLogs.actionLabels`. */
export function auditActionLabelKey(action: string): string {
  return action.replace(/\./g, "_");
}
