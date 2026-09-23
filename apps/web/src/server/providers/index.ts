/**
 * Provider registry and factories (spec 2).
 *
 * Business code obtains implementations through the get*() factories and
 * never depends on concrete classes, so Phase 2 can switch to PAdES / GM_SM2
 * without touching call sites.
 */

import type {
  SignatureProvider,
  IdentityVerifier,
  Notifier,
  StorageProvider,
  SignatureMethod,
} from "./types";

import { ImageSealProvider } from "./signature/image-seal";

import { getDefaultStorage } from "./storage/minio";

// ============================================================
// Type / value re-exports
// ============================================================

export type {
  SignatureProvider,
  IdentityVerifier,
  Notifier,
  StorageProvider,
  DocumentVersionRef,
  SignaturePlacement,
  SignerContext,
  SignResult,
  SignerRole,
  SignatureMethod,
  DocumentVersionStage,
  Locale,
  NotificationChannel,
  NotificationRecipient,
} from "./types";

export { NotImplementedError } from "./types";

export {
  ImageSealProvider,
  buildVersionKey,
  computeSha256,
} from "./signature/image-seal";
export type { ImageSealProviderDeps } from "./signature/image-seal";

export { PadesProvider } from "./signature/pades";
export { GmSm2Provider } from "./signature/gm-sm2";

export {
  EmailCodeVerifier,
  generateCode,
  hashCode,
  EmailCodeCooldownError,
} from "./identity/email-code";
export type { EmailCodeVerifierDeps } from "./identity/email-code";

export { FaceVerifier, RealNameVerifier } from "./identity";
export { SmsOtpVerifier, SmsOtpCooldownError } from "./identity/sms-otp";

export { EmailNotifier, renderIcu, sendEmail } from "./notify/email";
export type { EmailNotifierDeps, SendEmailInput } from "./notify/email";

export type { WecomMessage } from "./notify/wecom";
export { sendWecomMessage } from "./notify/wecom";
export { sendDingtalkMessage } from "./notify/dingtalk";
export { sendLarkMessage } from "./notify/lark";
export { sendSlackMessage } from "./notify/slack";
export { sendTeamsMessage } from "./notify/teams";

export {
  MinioStorageProvider,
  ObjectAlreadyExistsError,
  initDefaultStorage,
  getDefaultStorage,
} from "./storage/minio";
export type { MinioStorageProviderDeps } from "./storage/minio";

// ============================================================
// Registry (spec 2: swappable implementations)
// ============================================================

interface ProviderRegistry {
  signature: Map<SignatureMethod, SignatureProvider>;
  identity: IdentityVerifier | null;
  notifier: Notifier | null;
  storage: StorageProvider | null;
}

const registry: ProviderRegistry = {
  signature: new Map(),
  identity: null,
  notifier: null,
  storage: null,
};

/** Whether the Phase 1 defaults have been lazily bootstrapped. */
let stage1Bootstrapped = false;

/**
 * Register a SignatureProvider for a SignatureMethod.
 * Phase 1 maps IMAGE_SEAL / HANDWRITE to ImageSealProvider.
 * Phase 2 maps PADES → PadesProvider, GM_SM2 → GmSm2Provider.
 */
export function registerSignatureProvider(
  method: SignatureMethod,
  provider: SignatureProvider,
): void {
  registry.signature.set(method, provider);
}

export function getSignatureProvider(method: SignatureMethod): SignatureProvider {
  ensureStage1Defaults();
  const provider = registry.signature.get(method);
  if (!provider) {
    throw new Error(`No SignatureProvider registered for method ${method}`);
  }
  return provider;
}

export function registerIdentityVerifier(verifier: IdentityVerifier): void {
  registry.identity = verifier;
}

export function getIdentityVerifier(): IdentityVerifier {
  if (!registry.identity) {
    throw new Error("No IdentityVerifier registered; call registerIdentityVerifier first");
  }
  return registry.identity;
}

export function registerNotifier(notifier: Notifier): void {
  registry.notifier = notifier;
}

export function getNotifier(): Notifier {
  if (!registry.notifier) {
    throw new Error("No Notifier registered; call registerNotifier first");
  }
  return registry.notifier;
}

export function registerStorage(storage: StorageProvider): void {
  registry.storage = storage;
}

export function getStorage(): StorageProvider {
  ensureStage1Defaults();
  if (!registry.storage) {
    throw new Error("No StorageProvider registered; call registerStorage first");
  }
  return registry.storage;
}

// ============================================================
// Phase 1 default wiring
// ============================================================

/**
 * Lazily register the Phase 1 provider set:
 *   - StorageProvider → MinioStorageProvider (self-built from MINIO_* env vars)
 *   - SignatureProvider IMAGE_SEAL / HANDWRITE → ImageSealProvider
 *
 * IdentityVerifier and Notifier require a Prisma repository and are
 * constructed by their callers. Phase 2 providers are not registered here.
 */
function ensureStage1Defaults(): void {
  if (stage1Bootstrapped) return;
  const storage = getDefaultStorage();
  const imageSeal = new ImageSealProvider({ storage });
  registerSignatureProvider("IMAGE_SEAL", imageSeal);
  registerSignatureProvider("HANDWRITE", imageSeal);
  registerStorage(storage);
  stage1Bootstrapped = true;
}

/** Explicitly register Phase 1 defaults (idempotent; mostly useful in tests). */
export function registerStage1Defaults(): void {
  ensureStage1Defaults();
}

/** Register a Phase 2 compliant signature provider on demand. */
export function registerStage2Signature(method: "PADES" | "GM_SM2"): void {
  ensureStage1Defaults();
  const storage = getStorage();
  if (method === "PADES") {
    // Lazy: keep node-forge out of routes that only need storage / image seal.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PadesProvider } = require("./signature/pades") as typeof import("./signature/pades");
    registerSignatureProvider("PADES", new PadesProvider({ storage }));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GmSm2Provider } = require("./signature/gm-sm2") as typeof import("./signature/gm-sm2");
    registerSignatureProvider("GM_SM2", new GmSm2Provider({ storage }));
  }
}

/** Ensure PADES / GM_SM2 providers are registered (idempotent). */
export function ensureCryptoProviders(): void {
  ensureStage1Defaults();
  if (!registry.signature.has("PADES")) registerStage2Signature("PADES");
  if (!registry.signature.has("GM_SM2")) registerStage2Signature("GM_SM2");
}

/** Register only the signature method about to be used. */
export function ensureSignatureMethod(method: SignatureMethod): void {
  ensureStage1Defaults();
  if ((method === "PADES" || method === "GM_SM2") && !registry.signature.has(method)) {
    registerStage2Signature(method);
  }
}
