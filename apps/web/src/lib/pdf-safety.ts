import { ApiError } from "@/lib/api";

const MAX_TEMPLATE_BYTES = 20 * 1024 * 1024;

/** PDF magic bytes: %PDF- */
function hasPdfMagic(buf: Buffer): boolean {
  if (buf.length < 5) return false;
  return buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

/**
 * Reject PDFs that embed JavaScript, Launch actions, or EmbeddedFile
 * indicators — common malicious-PDF heuristics for template uploads.
 */
export function assertSafePdfUpload(buffer: Buffer): void {
  if (buffer.length === 0 || buffer.length > MAX_TEMPLATE_BYTES) {
    throw new ApiError(400, "TEMPLATE_PDF_TOO_LARGE", { maxMb: 20 });
  }
  if (!hasPdfMagic(buffer)) {
    throw new ApiError(400, "TEMPLATE_PDF_INVALID");
  }

  // Scan a UTF-8-lossy view for dangerous PDF name tokens (case-sensitive PDF names).
  const sample = buffer.toString("latin1");
  const dangerous = [
    "/JavaScript",
    "/JS",
    "/Launch",
    "/EmbeddedFile",
    "/RichMedia",
    "/AA",
    "/OpenAction",
  ];
  for (const token of dangerous) {
    if (sample.includes(token)) {
      throw new ApiError(400, "TEMPLATE_PDF_UNSAFE");
    }
  }
}
