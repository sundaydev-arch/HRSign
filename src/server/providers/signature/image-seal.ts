/**
 * ImageSealProvider — default Phase 1 SignatureProvider (spec 2 / 0 / 12).
 *
 * Overlays a company seal PNG or a handwritten signature PNG onto one or more
 * placements in a PDF, producing a new immutable document version (spec 3.2).
 *
 * Disclaimer (spec 0): internal traceability only; no legal-validity claim.
 *   - No CA certificate is embedded.
 *   - No timestamp token is embedded.
 *   - PDF metadata is not altered to claim "reliable" e-signature status.
 *   verify() only compares SHA-256 file hashes; valid=true means the stored
 *   file has not been replaced.
 *
 * Terminology (spec 0):
 *   - IMAGE_SEAL: company seal (Seal) image overlay.
 *   - HANDWRITE: personal handwritten signature (Signature) image overlay.
 */

import { createHash } from "node:crypto";

import { stampPdf } from "@/lib/pdf/stamp";
import type { SignatureVerificationResult } from "@/schemas/signature";
import type {
  DocumentVersionRef,
  DocumentVersionStage,
  SignatureProvider,
  SignerContext,
  SignResult,
  StorageProvider,
} from "../types";

export interface ImageSealProviderDeps {
  storage: StorageProvider;
}

/**
 * Build the storage key of a new version (spec 3.2: key carries the version,
 * overwrite is forbidden). Shape: documents/{docId}/v{version}-{stage}.pdf
 */
export function buildVersionKey(
  documentId: string,
  version: number,
  stage: string,
): string {
  return `documents/${documentId}/v${version}-${stage.toLowerCase()}.pdf`;
}

/** Compute the SHA-256 hex digest of a document version. */
export function computeSha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export class ImageSealProvider implements SignatureProvider {
  private readonly storage: StorageProvider;

  constructor(deps: ImageSealProviderDeps) {
    this.storage = deps.storage;
  }

  async sign(input: {
    source: DocumentVersionRef;
    signer: SignerContext;
    watermarkText?: string;
  }): Promise<SignResult> {
    const { source, signer, watermarkText } = input;

    // spec 12 / 0: seal master images are read server-side; Phase 1 always
    // requires the PNG bytes (either a seal read from storage or an uploaded
    // handwritten signature).
    if (!signer.imageBytes || signer.placements.length === 0) {
      throw new Error("ImageSealProvider.sign requires imageBytes and at least one placement");
    }

    // 1. Read the source version bytes.
    const sourceBytes = await this.storage.get(source.storageKey);

    // 2. Overlay the image on every placement in a single render pass and
    //    optionally draw the global watermark. Coordinate semantics (top-left
    //    origin in the current editor data) are handled by the stamp engine.
    const renderedBytes = await stampPdf(
      sourceBytes,
      signer.placements.map((placement) => ({
        page: placement.coordinates.page,
        x: placement.coordinates.x,
        y: placement.coordinates.y,
        width: placement.coordinates.width,
        height: placement.coordinates.height,
        imageBytes: signer.imageBytes as Buffer,
      })),
      watermarkText ? { watermarkText } : {},
    );

    // 3. Determine the new version number and stage (spec 3.2 pipeline:
    //    FILLED → WATERMARKED → SEALED → SIGNED).
    const newVersionNumber = source.version + 1;
    const newStage: DocumentVersionStage =
      signer.signerRole === "COMPANY_SEAL" ? "SEALED" : "SIGNED";
    const newStorageKey = buildVersionKey(source.documentId, newVersionNumber, newStage);
    const newSha256 = computeSha256(renderedBytes);

    // 4. Store the new version (put rejects overwrite).
    await this.storage.put({
      key: newStorageKey,
      data: renderedBytes,
      contentType: "application/pdf",
    });

    // 5. Store a per-action audit copy of the stamped image under a unique key
    //    (backend-only; never exposed via the UI for seal masters, spec 12).
    //    Keyed by taskId to match the /api/files signatures authorization
    //    rule: signatures/{taskId}/{timestamp}.png.
    const signatureImageKey = `signatures/${signer.taskId}/${Date.now()}.png`;
    await this.storage.put({
      key: signatureImageKey,
      data: signer.imageBytes,
      contentType: "image/png",
    });

    // 6. Phase 1 verification result: file integrity only (spec 0).
    const verificationResult: SignatureVerificationResult = {
      valid: true,
      method: signer.method,
      verifiedAt: new Date().toISOString(),
      details: {
        sourceSha256: source.sha256,
        newSha256,
        note: "Phase 1 image seal/signature: file integrity check only, no legal-validity guarantee",
      },
    };

    return {
      newVersion: {
        documentId: source.documentId,
        version: newVersionNumber,
        stage: newStage,
        storageKey: newStorageKey,
        sha256: newSha256,
      },
      signature: {
        method: signer.method,
        storageKey: signatureImageKey,
        sealId: signer.sealId,
        fieldIds: signer.placements.map((placement) => placement.fieldId),
        verificationResult,
      },
    };
  }

  async verify(input: {
    documentVersion: DocumentVersionRef;
    signature: {
      method: string;
      storageKey: string | null;
      verificationResult: SignatureVerificationResult | null;
    };
  }): Promise<SignatureVerificationResult> {
    // Phase 1: re-download the file and compare its SHA-256 hash.
    const bytes = await this.storage.get(input.documentVersion.storageKey);
    const actualSha256 = computeSha256(bytes);
    const valid = actualSha256 === input.documentVersion.sha256;

    return {
      valid,
      method: input.signature.method as SignatureVerificationResult["method"],
      verifiedAt: new Date().toISOString(),
      details: valid
        ? { note: "File SHA-256 matches (Phase 1 integrity check only)" }
        : {
            note: "File SHA-256 mismatch; the file may have been tampered with",
            expected: input.documentVersion.sha256,
            actual: actualSha256,
          },
      errorCode: valid ? undefined : "FILE_HASH_MISMATCH",
    };
  }
}
