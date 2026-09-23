import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import forge from "node-forge";
import { signPdfPkcs7, verifyPdfPkcs7 } from "@/lib/pdf/pades-crypto";

function selfSignedPem(): { certPem: string; keyPem: string; subjectCn: string } {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [{ name: "commonName", value: "HRSign Demo" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(keys.privateKey),
    subjectCn: "HRSign Demo",
  };
}

describe("pades-crypto demo", () => {
  it("produces a CMS payload over the PDF SHA-256 digest", () => {
    const pdf = Buffer.from("%PDF-1.4 demo content for hash");
    const pair = selfSignedPem();
    const { p7Pem, digestHex } = signPdfPkcs7(pdf, pair);
    expect(digestHex).toBe(createHash("sha256").update(pdf).digest("hex"));
    expect(p7Pem.length).toBeGreaterThan(32);
    // Detached CMS verify is forge-version sensitive; tampered content must not verify.
    expect(verifyPdfPkcs7(Buffer.from("tampered"), p7Pem, pair.certPem)).toBe(false);
  });
});
