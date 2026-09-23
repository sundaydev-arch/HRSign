/**
 * Load / generate RSA PEM for demo PAdES (1A self-signed).
 * Prefers env PADES_CERT_PEM / PADES_KEY_PEM, then AppSettings, then generates once to settings.
 */

import forge from "node-forge";
import { prisma } from "@/lib/prisma";

export interface PemPair {
  certPem: string;
  keyPem: string;
  subjectCn: string;
}

function generateSelfSigned(): PemPair {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = String(Date.now());
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);
  const attrs = [
    { name: "commonName", value: "HRSign Demo CA" },
    { name: "organizationName", value: "HRSign" },
    { name: "countryName", value: "CN" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: true },
    { name: "keyUsage", keyCertSign: true, digitalSignature: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(keys.privateKey),
    subjectCn: "HRSign Demo CA",
  };
}

export async function resolvePadesPem(): Promise<PemPair> {
  const envCert = process.env.PADES_CERT_PEM?.trim();
  const envKey = process.env.PADES_KEY_PEM?.trim();
  if (envCert && envKey) {
    return { certPem: envCert, keyPem: envKey, subjectCn: "env" };
  }

  const row = await prisma.appSettings.findUnique({ where: { id: "default" } });
  if (row?.padesCertPem && row?.padesKeyPem) {
    return {
      certPem: row.padesCertPem,
      keyPem: row.padesKeyPem,
      subjectCn: "stored",
    };
  }

  const generated = generateSelfSigned();
  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      watermarkText: process.env.WATERMARK_TEXT ?? "HRSign INTERNAL",
      padesCertPem: generated.certPem,
      padesKeyPem: generated.keyPem,
    },
    update: {
      padesCertPem: generated.certPem,
      padesKeyPem: generated.keyPem,
    },
  });
  return generated;
}

/** Detached PKCS#7 (CMS) signature over PDF bytes — demo PAdES-B-B payload. */
export function signPdfPkcs7(pdfBytes: Buffer, pair: PemPair): { p7Pem: string; digestHex: string } {
  const cert = forge.pki.certificateFromPem(pair.certPem);
  const key = forge.pki.privateKeyFromPem(pair.keyPem);
  const md = forge.md.sha256.create();
  md.update(pdfBytes.toString("binary"));
  const digestHex = md.digest().toHex();

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(pdfBytes.toString("binary"));
  p7.addCertificate(cert);
  p7.addSigner({
    key: key as forge.pki.rsa.PrivateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256 as string,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType as string, value: forge.pki.oids.data as string },
      { type: forge.pki.oids.messageDigest as string },
      { type: forge.pki.oids.signingTime as string, value: new Date() as unknown as string },
    ],
  } as Parameters<typeof p7.addSigner>[0]);
  p7.sign({ detached: true });
  const asn1 = p7.toAsn1();
  const der = forge.asn1.toDer(asn1).getBytes();
  const p7Pem = forge.util.encode64(der);
  return { p7Pem, digestHex };
}

export function verifyPdfPkcs7(
  pdfBytes: Buffer,
  p7Base64: string,
  certPem: string,
): boolean {
  try {
    const der = forge.util.decode64(p7Base64);
    const asn1 = forge.asn1.fromDer(der);
    const p7 = forge.pkcs7.messageFromAsn1(asn1) as unknown as forge.pkcs7.PkcsSignedData & {
      verify: (opts: { certificate: forge.pki.Certificate }) => boolean;
    };
    p7.content = forge.util.createBuffer(pdfBytes.toString("binary"));
    const cert = forge.pki.certificateFromPem(certPem);
    return p7.verify({ certificate: cert });
  } catch {
    return false;
  }
}
