/**
 * GmSm2Provider (1A demo) — visual stamp + SM2 signature over PDF SHA-256 digest.
 */

import { createHash, randomBytes } from "node:crypto";
import { sm2 } from "sm-crypto";
import type { SignatureVerificationResult } from "@/schemas/signature";
import { prisma } from "@/lib/prisma";
import {
  ImageSealProvider,
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

async function resolveSm2KeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const envPub = process.env.GM_SM2_PUBLIC_KEY?.trim();
  const envPriv = process.env.GM_SM2_PRIVATE_KEY?.trim();
  if (envPub && envPriv) return { publicKey: envPub, privateKey: envPriv };

  const row = await prisma.appSettings.findUnique({ where: { id: "default" } });
  if (row?.sm2KeyJson) {
    return JSON.parse(row.sm2KeyJson) as { publicKey: string; privateKey: string };
  }

  const keypair = sm2.generateKeyPairHex();
  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      watermarkText: process.env.WATERMARK_TEXT ?? "HRSign INTERNAL",
      sm2KeyJson: JSON.stringify(keypair),
    },
    update: { sm2KeyJson: JSON.stringify(keypair) },
  });
  return keypair;
}

export class GmSm2Provider implements SignatureProvider {
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
    const visual = await this.imageSeal.sign({
      ...input,
      signer: {
        ...input.signer,
        method: input.signer.signerRole === "COMPANY_SEAL" ? "IMAGE_SEAL" : "HANDWRITE",
      },
    });

    const pdfBytes = await this.storage.get(visual.newVersion.storageKey);
    const digest = createHash("sha256").update(pdfBytes).digest("hex");
    const { publicKey, privateKey } = await resolveSm2KeyPair();
    const sigHex = sm2.doSignature(digest, privateKey, { hash: true });

    const sigKey = `signatures/${input.signer.taskId}/${Date.now()}-sm2.json`;
    await this.storage.put({
      key: sigKey,
      data: Buffer.from(
        JSON.stringify({
          alg: "SM2",
          digestSha256: digest,
          signature: sigHex,
          publicKey,
          nonce: randomBytes(8).toString("hex"),
        }),
        "utf8",
      ),
      contentType: "application/json",
    });

    return {
      newVersion: visual.newVersion,
      signature: {
        method: "GM_SM2",
        storageKey: visual.signature.storageKey,
        sealId: visual.signature.sealId,
        fieldIds: visual.signature.fieldIds,
        verificationResult: {
          valid: true,
          method: "GM_SM2",
          verifiedAt: new Date().toISOString(),
          details: {
            mode: "demo-sm2",
            digestSha256: digest,
            sm2StorageKey: sigKey,
            note: "Demo SM2 signature over PDF digest — not OSCCA-accredited",
          },
        },
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
    const sm2Key = input.signature.verificationResult?.details?.sm2StorageKey;
    let sm2Ok = false;
    if (typeof sm2Key === "string") {
      try {
        const payload = JSON.parse((await this.storage.get(sm2Key)).toString("utf8")) as {
          digestSha256: string;
          signature: string;
          publicKey: string;
        };
        const digest = createHash("sha256").update(bytes).digest("hex");
        sm2Ok =
          digest === payload.digestSha256 &&
          sm2.doVerifySignature(digest, payload.signature, payload.publicKey, { hash: true });
      } catch {
        sm2Ok = false;
      }
    }
    const valid = hashOk && sm2Ok;
    return {
      valid,
      method: "GM_SM2",
      verifiedAt: new Date().toISOString(),
      details: { hashOk, sm2Ok, mode: "demo-sm2" },
      errorCode: valid ? undefined : "GM_SM2_VERIFY_FAILED",
    };
  }
}
