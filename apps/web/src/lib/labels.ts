import type {
  ApprovalStatus,
  DocumentVersionStage,
  FieldType,
  SealStyle,
  SignerRole,
  SignerStatus,
  SigningFlowType,
  SigningStatus,
  TemplateCategory,
  TemplateVersionStatus,
} from "@prisma/client";

/**
 * Enum → i18n message-key maps.
 *
 * Display text must never be hard-coded: components resolve these keys with a
 * next-intl translator bound to the "labels" namespace, e.g.
 * `tLabel(TEMPLATE_CATEGORY_LABEL_KEYS[category])`.
 */

export const TEMPLATE_CATEGORY_LABEL_KEYS: Record<TemplateCategory, string> = {
  OFFER: "category.OFFER",
  ENTRY: "category.ENTRY",
  CONTRACT: "category.CONTRACT",
  RESIGN: "category.RESIGN",
  CERTIFICATE: "category.CERTIFICATE",
};

// spec 3.1: template version status (immutable after publication).
export const TEMPLATE_STATUS_LABEL_KEYS: Record<TemplateVersionStatus, string> = {
  DRAFT: "templateStatus.DRAFT",
  PUBLISHED: "templateStatus.PUBLISHED",
  ARCHIVED: "templateStatus.ARCHIVED",
};

export const TEMPLATE_STATUS_VARIANTS: Record<TemplateVersionStatus, "default" | "secondary" | "destructive" | "outline" | "success" | "accent"> = {
  DRAFT: "secondary",
  PUBLISHED: "success",
  ARCHIVED: "outline",
};

// spec 3.3: approval and signing are two independent state machines.
export const APPROVAL_STATUS_LABEL_KEYS: Record<ApprovalStatus, string> = {
  DRAFT: "approvalStatus.DRAFT",
  PENDING: "approvalStatus.PENDING",
  APPROVED: "approvalStatus.APPROVED",
  REJECTED: "approvalStatus.REJECTED",
  WITHDRAWN: "approvalStatus.WITHDRAWN",
};

export const APPROVAL_STATUS_VARIANTS: Record<ApprovalStatus, "default" | "secondary" | "destructive" | "outline" | "success" | "accent"> = {
  DRAFT: "secondary",
  PENDING: "default",
  APPROVED: "success",
  REJECTED: "destructive",
  WITHDRAWN: "outline",
};

export const SIGNING_STATUS_LABEL_KEYS: Record<SigningStatus, string> = {
  NOT_STARTED: "signingStatus.NOT_STARTED",
  IN_PROGRESS: "signingStatus.IN_PROGRESS",
  COMPLETED: "signingStatus.COMPLETED",
  DECLINED: "signingStatus.DECLINED",
  EXPIRED: "signingStatus.EXPIRED",
  REVOKED: "signingStatus.REVOKED",
};

export const SIGNING_STATUS_VARIANTS: Record<SigningStatus, "default" | "secondary" | "destructive" | "outline" | "success" | "accent"> = {
  NOT_STARTED: "secondary",
  IN_PROGRESS: "accent",
  COMPLETED: "success",
  DECLINED: "destructive",
  EXPIRED: "outline",
  REVOKED: "outline",
};

export const TASK_FLOW_LABEL_KEYS: Record<SigningFlowType, string> = {
  SEQUENTIAL: "flowType.SEQUENTIAL",
  PARALLEL: "flowType.PARALLEL",
};

export const SIGNER_ROLE_LABEL_KEYS: Record<SignerRole, string> = {
  APPROVER: "signerRole.APPROVER",
  COMPANY_SEAL: "signerRole.COMPANY_SEAL",
  PERSONAL_SIGNATURE: "signerRole.PERSONAL_SIGNATURE",
};

export const SIGNER_STATUS_LABEL_KEYS: Record<SignerStatus, string> = {
  PENDING: "signerStatus.PENDING",
  VIEWED: "signerStatus.VIEWED",
  SIGNED: "signerStatus.SIGNED",
  DECLINED: "signerStatus.DECLINED",
};

/** Resolve with `useTranslations("seals")`. */
export const SEAL_STYLE_LABEL_KEYS: Record<SealStyle, string> = {
  ROUND_CHINESE: "style.ROUND_CHINESE",
  TEXT_INTERNATIONAL: "style.TEXT_INTERNATIONAL",
  NONE: "style.NONE",
};

export const FIELD_TYPE_LABEL_KEYS: Record<FieldType, string> = {
  TEXT: "fieldType.TEXT",
  DATE: "fieldType.DATE",
  SEAL: "fieldType.SEAL",
  SIGNATURE: "fieldType.SIGNATURE",
  PERFORATION_SEAL: "fieldType.PERFORATION_SEAL",
};

// spec 3.2: document version stages (fixed pipeline order).
export const DOCUMENT_STAGE_LABEL_KEYS: Record<DocumentVersionStage, string> = {
  FILLED: "documentStage.FILLED",
  WATERMARKED: "documentStage.WATERMARKED",
  SEALED: "documentStage.SEALED",
  SIGNED: "documentStage.SIGNED",
};

// Numeric, locale-neutral timestamp used across dashboard tables.
export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}
