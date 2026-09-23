/**
 * PadesProvider (1A) — visual stamp via ImageSeal, then detached PKCS#7 CMS
 * over the PDF bytes with a self-signed / imported PEM certificate.
 *
 * Not a production CA / PAdES-B-LTV stack. Demo / internal evidence only.
 */

import type { SignatureVerificationResult } from "@/schemas/signature";
import { resolvePadesPem, signPdfPkcs7, verifyPdfPkcs7 } from "@/lib/pdf/pades-crypto";
import {
  ImageSealProvider,
  buildVersionKey,
  computeSha256,
  type ImageSealProviderDeps,
} from "./image-seal";
import type {
  DocumentVersionRef,
  SignatureProvider,
  SignerContext,
  SignResult,
  StorageProvider,
} from "../types";

export class PadesProvider implements SignatureProvider {
  private readonly storage: StorageProvider;
  private readonly imageSeal: ImageSealProvider;

  constructor(deps: ImageSealProviderDeps) {
    this.storage = deps.storage;
    this.imageSeal = new ImageSealProvider(deps);
  }

  async sign(input: {
    source: DocumentVersionRef;
    signer: SignerContext;
    watermarkText?: string;
    claimedVersion: number;
  }): Promise<SignResult> {
    // 1. Visual overlay first (same as Phase 1)
    const visual = await this.imageSeal.sign({
      ...input,
      signer: { ...input.signer, method: input.signer.method === "PADES" ? "IMAGE_SEAL" : "HANDWRITE" },
    });

    // 2. Cryptographic CMS over stamped PDF
    const pdfBytes = await this.storage.get(visual.newVersion.storageKey);
    const pair = await resolvePadesPem();
    const { p7Pem, digestHex } = signPdfPkcs7(pdfBytes, pair);

    const sigKey = `signatures/${input.signer.taskId}/${Date.now()}-pades.p7s`;
    await this.storage.put({
      key: sigKey,
      data: Buffer.from(p7Pem, "utf8"),
      contentType: "application/pkcs7-signature",
    });

    const verificationResult: SignatureVerificationResult = {
      valid: true,
      method: "PADES",
      verifiedAt: new Date().toISOString(),
      details: {
        mode: "demo-pades-b-b",
        digestSha256: digestHex,
        note: "Self-signed / imported PEM PKCS#7 detached signature — not a production CA claim",
        cmsStorageKey: sigKey,
      },
    };

    return {
      newVersion: visual.newVersion,
      signature: {
        method: "PADES",
        storageKey: visual.signature.storageKey,
        sealId: visual.signature.sealId,
        fieldIds: visual.signature.fieldIds,
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
    const bytes = await this.storage.get(input.documentVersion.storageKey);
    const hashOk = computeSha256(bytes) === input.documentVersion.sha256;
    const cmsKey = input.signature.verificationResult?.details?.cmsStorageKey;
    let cmsOk = false;
    if (typeof cmsKey === "string") {
      try {
        const p7 = (await this.storage.get(cmsKey)).toString("utf8");
        const pair = await resolvePadesPem();
        cmsOk = verifyPdfPkcs7(bytes, p7, pair.certPem);
      } catch {
        cmsOk = false;
      }
    }
    const valid = hashOk && cmsOk;
    return {
      valid,
      method: "PADES",
      verifiedAt: new Date().toISOString(),
      details: { hashOk, cmsOk, mode: "demo-pades-b-b" },
      errorCode: valid ? undefined : "PADES_VERIFY_FAILED",
    };
  }
}

export { buildVersionKey };
