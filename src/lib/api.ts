import { NextResponse } from "next/server";

/**
 * Machine-readable API error codes.
 *
 * The backend never returns localized messages: every error response carries a
 * stable code plus optional interpolation parameters. Clients render the
 * user-facing text in their own locale (see messages/*.json).
 *
 * Response shape: `{ "error": { "code": "...", "params": { ... } } }`.
 */
export const ERROR_CODES = [
  // Generic
  "INTERNAL_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",

  // Files
  "FILE_NOT_FOUND",
  "FILE_ACCESS_DENIED",
  "TEMPLATE_FILE_ACCESS_DENIED",
  "UNKNOWN_FILE_TYPE",

  // Signing tasks
  "TASK_NOT_FOUND",
  "TASK_ACCESS_DENIED",
  "TASK_NOT_PENDING_APPROVAL",
  "NOT_TASK_APPROVER",
  "NOT_TASK_SIGNER",
  "NOT_YOUR_TURN",
  "SIGN_LINK_INVALID",
  "SIGNING_METHOD_INVALID",
  "EXTERNAL_SIGN_HANDWRITE_ONLY",
  "TASK_ALREADY_PROCESSED",
  "TASK_NOT_SIGNABLE",
  "SEAL_REQUIRES_APPROVAL",
  "SIGNING_FIELD_MISSING",
  "DOCUMENT_VERSION_MISSING",

  // Task creation
  "TEMPLATE_REQUIRED",
  "TASK_TITLE_REQUIRED",
  "EXPIRY_MUST_BE_FUTURE",
  "SIGNERS_REQUIRED",
  "TEMPLATE_NOT_PUBLISHED",
  "SIGNER_ROLE_INVALID",
  "SIGNER_INFO_INCOMPLETE",
  "SIGNER_ACCOUNT_INVALID",
  "COMPANY_SEAL_SIGNER_REQUIRED",
  "PERSONAL_SIGNER_REQUIRED",
  "REQUIRED_FIELD_MISSING",

  // Templates
  "TEMPLATE_NOT_FOUND",
  "TEMPLATE_VERSION_MISSING",
  "PUBLISHED_VERSION_NOT_EDITABLE",
  "PUBLISHED_STATUS_LOCKED",
  "TEMPLATE_NAME_REQUIRED",
  "TEMPLATE_CATEGORY_INVALID",
  "TEMPLATE_STATUS_INVALID",
  "TEMPLATE_PDF_REQUIRED",
  "TEMPLATE_PDF_TOO_LARGE",
  "TEMPLATE_PDF_INVALID",
  "FIELDS_INVALID",
  "FIELD_TYPE_INVALID",
  "FIELD_LABEL_REQUIRED",
  "FIELD_PAGE_OUT_OF_RANGE",
  "FIELD_GEOMETRY_INVALID",

  // Seals
  "SEAL_NOT_FOUND",
  "SEAL_NAME_REQUIRED",
  "SEAL_IMAGE_REQUIRED",
  "SEAL_IMAGE_TOO_LARGE",
  "SEAL_MUST_BE_PNG",
  "SEAL_IMAGE_INVALID",
  "SEAL_REQUIRED",
  "SEAL_ROLE_REQUIRED",
  "SIGNATURE_ROLE_REQUIRED",
  "SIGNATURE_IMAGE_INVALID",
  "SIGNATURE_IMAGE_TOO_LARGE",

  // Users
  "USER_NOT_FOUND",
  "USER_EMAIL_INVALID",
  "USER_NAME_REQUIRED",
  "PASSWORD_TOO_SHORT",
  "ROLE_INVALID",
  "EMAIL_ALREADY_REGISTERED",
  "CANNOT_DEMOTE_OWN_SUPER_ADMIN",
  "CANNOT_DISABLE_OWN_ACCOUNT",
  "NO_UPDATE_DATA",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Interpolation parameters shipped alongside an error code. */
export type ErrorParams = Record<string, string | number | boolean>;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    public params?: ErrorParams,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export function jsonError(
  status: number,
  code: ErrorCode,
  params?: ErrorParams,
): NextResponse {
  return NextResponse.json(
    { error: { code, ...(params ? { params } : {}) } },
    { status },
  );
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return jsonError(err.status, err.code, err.params);
  }
  console.error("[api] unexpected error:", err);
  return jsonError(500, "INTERNAL_ERROR");
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function getUserAgent(req: Request): string {
  return req.headers.get("user-agent") ?? "unknown";
}
