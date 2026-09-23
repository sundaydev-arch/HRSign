import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** URL-safe short code for signing links (≈ 10 chars, ~59 bits). */
export function generateShortCode(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

/** High-entropy token for invite / password-reset email links. */
export function generateCredentialToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
