/**
 * Core provider interfaces (spec section 2).
 *
 * Business code depends only on these interfaces, never on concrete
 * implementations.
 * Phase 1: ImageSealProvider / EmailCodeVerifier / EmailNotifier /
 *          MinioStorageProvider.
 * Phase 2: PadesProvider / GmSm2Provider / face verification (interfaces and
 *          stubs only).
 *
 * Terminology (spec 0): a company seal is a "Seal"; a personal handwritten
 * mark is a "Signature". The two must never be mixed.
 */

import type { Readable } from "node:stream";
import type { Coordinates } from "@/schemas/coordinates";
import type { SignatureVerificationResult } from "@/schemas/signature";
import type { NotificationParams } from "@/schemas/notification";

// ============================================================
// Shared base types
// ============================================================

/** Document version stages (spec 3.2). */
export type DocumentVersionStage = "FILLED" | "WATERMARKED" | "SEALED" | "SIGNED";

/** Signature methods (spec 0: Phase 1 uses IMAGE_SEAL / HANDWRITE). */
export type SignatureMethod = "IMAGE_SEAL" | "HANDWRITE" | "PADES" | "GM_SM2";

/** Signer roles (spec 15 SignerRole). */
export type SignerRole = "APPROVER" | "COMPANY_SEAL" | "PERSONAL_SIGNATURE";

/**
 * Persistence-side locale (mirrors the Prisma UserLocale / TemplateLocale
 * enums, underscore form). The UI uses BCP-47 ("zh-CN"); convert at the
 * boundary with toDbLocale()/toAppLocale() from @/i18n/config.
 */
export type Locale = "zh_CN" | "en";

/** Notification channels (spec 2 Notifier). */
export type NotificationChannel = "EMAIL" | "WECOM" | "DINGTALK" | "LARK";

// ============================================================
// SignatureProvider (spec 2 / 0 / 12)
// ============================================================

/** Source document version to be signed (spec 3.2); only the fields providers need. */
export interface DocumentVersionRef {
  documentId: string;
  version: number;
  stage: DocumentVersionStage;
  storageKey: string;
  sha256: string;
}

/** One seal/signature placement on the PDF. */
export interface SignaturePlacement {
  /** TemplateField.id that this placement fulfils. */
  fieldId: string;
  /** Field coordinates (spec 3.1: PDF points; origin semantics defined by the engine). */
  coordinates: Coordinates;
}

/** Per-action signing context (spec 0: Seal vs Signature terminology). */
export interface SignerContext {
  /** SigningTask.id (used for evidence-object key namespacing). */
  taskId: string;
  /** Signer.id */
  signerId: string;
  signerRole: SignerRole;
  /** Operator User.id; null for an external signer without an account. */
  operatorId: string | null;
  /** Signature method (maps to Signature.method). */
  method: SignatureMethod;
  /**
   * Phase 1: PNG bytes of the seal/signature image (transparent background).
   *   - IMAGE_SEAL: company seal image read server-side (never sent to clients).
   *   - HANDWRITE: handwritten signature exported from the canvas.
   * Phase 2: null (PAdES/GM_SM2 sign with certificates).
   */
  imageBytes: Buffer | null;
  /** Related seal id (required when method = IMAGE_SEAL). */
  sealId: string | null;
  /** One or more field placements rendered in this single signing action. */
  placements: SignaturePlacement[];
  /** spec 4: record IP / user agent for every action. */
  ip: string | null;
  userAgent: string | null;
}

/** Result of a signing action. */
export interface SignResult {
  /** New DocumentVersion (spec 3.2: every action produces a new version). */
  newVersion: {
    documentId: string;
    version: number;
    stage: DocumentVersionStage;
    storageKey: string;
    sha256: string;
  };
  /** Signature record data to persist (one Signature row per placement). */
  signature: {
    method: SignatureMethod;
    /** Storage key of the captured signature image (Phase 1), if stored. */
    storageKey: string | null;
    sealId: string | null;
    fieldIds: string[];
    verificationResult: SignatureVerificationResult;
  };
}

/**
 * SignatureProvider interface (spec 2).
 *
 * sign: overlay seal/signature images on a document version → new version.
 * verify: verify a given document version.
 *
 * Phase 1 ImageSealProvider overlays images only, no legal guarantee.
 * Phase 2 PadesProvider / GmSm2Provider provide compliant signatures.
 */
export interface SignatureProvider {
  sign(input: {
    source: DocumentVersionRef;
    signer: SignerContext;
    /** Optional global watermark text drawn behind the content. */
    watermarkText?: string;
  }): Promise<SignResult>;

  verify(input: {
    documentVersion: DocumentVersionRef;
    signature: {
      method: SignatureMethod;
      storageKey: string | null;
      verificationResult: SignatureVerificationResult | null;
    };
  }): Promise<SignatureVerificationResult>;
}

// ============================================================
// IdentityVerifier (spec 2 / 4)
// ============================================================

/**
 * IdentityVerifier interface (spec 2).
 *
 * Phase 1 EmailCodeVerifier: email code with attempt limits + cooldown.
 * Phase 2 face/real-name verification: interfaces only; no biometric storage.
 */
export interface IdentityVerifier {
  /** Start verification (e.g. send a code); returns the record id. */
  startVerification(input: {
    target: string; // email / phone number
    /** Related SigningToken (external signing flow). */
    signingTokenId: string | null;
    locale: Locale;
    ip: string | null;
    userAgent: string | null;
  }): Promise<{
    verificationId: string;
    /** Code validity period (minutes). */
    expiresAt: Date;
  }>;

  /** Check the code submitted by the user. */
  checkResult(input: {
    verificationId: string;
    code: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<{
    status: "VERIFIED" | "FAILED" | "EXPIRED";
    /** Remaining attempts (returned on failure). */
    remainingAttempts: number;
  }>;
}

// ============================================================
// Notifier (spec 2 / 20.1)
// ============================================================

export interface NotificationRecipient {
  /** Internal user id (optional). */
  userId: string | null;
  email: string | null;
  phone: string | null;
  /** Preferred language (spec 20.1: signer preference → initiator → browser). */
  locale: Locale;
}

/**
 * Notifier interface (spec 2).
 *
 * Email (SMTP) is mandatory in Phase 1; WeCom/DingTalk/Lark are optional
 * adapters. Implementations provide retries and i18n ICU template rendering.
 * The backend returns error codes + parameters only (spec 20.1); the client
 * renders localized text.
 */
export interface Notifier {
  send(input: {
    channel: NotificationChannel;
    recipient: NotificationRecipient;
    /** Template key, e.g. "signing.invitation". */
    templateKey: string;
    /** ICU MessageFormat variables. */
    params: NotificationParams;
    /** Related task (for audit traceability). */
    taskId: string | null;
  }): Promise<{
    notificationLogId: string;
    status: "SENT" | "FAILED" | "SKIPPED";
    error: string | null;
  }>;
}

// ============================================================
// StorageProvider (spec 2 / 12)
// ============================================================

/**
 * StorageProvider interface (spec 2).
 *
 * - Keys carry a version suffix; overwrite is rejected on put.
 * - Master seal images are read server-side only (spec 12).
 * - presignGet produces short-lived URLs (spec 12).
 */
export interface StorageProvider {
  /** Put an object; throws if the key already exists (spec 3.2). */
  put(input: {
    key: string;
    data: Buffer | Readable;
    contentType: string;
    /** Skip the existence check (internal use only, e.g. static font files). */
    allowOverwrite?: boolean;
  }): Promise<void>;

  /** Download an object as a Buffer. */
  get(key: string): Promise<Buffer>;

  /** Generate a short-lived presigned GET URL. */
  presignGet(input: { key: string; expiresIn?: number }): Promise<string>;

  /** Delete an object (spec 9: hard delete is handled by retention-scan). */
  delete(key: string): Promise<void>;

  /** Whether an object exists. */
  exists(key: string): Promise<boolean>;
}

// ============================================================
// Phase 2 not-implemented error
// ============================================================

/**
 * Thrown by Phase 2-only providers (spec 18: Phase 2 is not built now):
 * PadesProvider / GmSm2Provider / face verification.
 */
export class NotImplementedError extends Error {
  readonly feature: string;

  constructor(feature: string) {
    super(`Phase 2 feature is not implemented: ${feature} (spec 18)`);
    this.name = "NotImplementedError";
    this.feature = feature;
  }
}
