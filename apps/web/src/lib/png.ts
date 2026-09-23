/**
 * Read width/height from a PNG buffer via the IHDR chunk (no deps).
 * Returns null if the buffer is not a valid PNG with IHDR.
 */
export function readPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(magic)) return null;
  // IHDR is always the first chunk: length(4) + type(4) + data(13) …
  const type = buf.toString("ascii", 12, 16);
  if (type !== "IHDR") return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}
