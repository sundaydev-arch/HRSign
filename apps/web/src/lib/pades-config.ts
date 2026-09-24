/**
 * PAdES configuration gate — operator-supplied PEM enables crypto signing.
 */

export function isPadesConfigured(): boolean {
  const cert =
    process.env.PADES_CERT_PEM?.trim() ||
    process.env.PADES_CERT_PATH?.trim();
  const key =
    process.env.PADES_KEY_PEM?.trim() ||
    process.env.PADES_KEY_PATH?.trim();
  return Boolean(cert && key);
}

export function padesProviderStatus(): "available" | "partial" | "stub" {
  if (isPadesConfigured()) return "available";
  // Self-signed fallback via AppSettings still works for demos.
  return "partial";
}
