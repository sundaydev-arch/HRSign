import fs from "node:fs/promises";
import path from "node:path";
import { webPublicDir } from "@/lib/paths";

let cachedFont: Buffer | null = null;

/**
 * Load Noto Sans SC as a static TrueType font.
 *
 * pdf-lib + fontkit corrupt CJK glyphs when subsetting, and browser pdf.js
 * often garbles CFF/OTF CID fonts. Ship a pre-subsetted static `.ttf` (GB2312-
 * class coverage) and always embed with `{ subset: false }`.
 */
export async function loadChineseFont(): Promise<Buffer> {
  if (cachedFont) return cachedFont;
  const fontsDir = path.join(webPublicDir(), "fonts");
  const candidates = ["NotoSansSC-Regular.ttf", "NotoSansSC-Regular.otf"];
  for (const name of candidates) {
    const fontPath = path.join(fontsDir, name);
    try {
      cachedFont = await fs.readFile(fontPath);
      return cachedFont;
    } catch {
      // try next
    }
  }
  throw new Error("CJK font missing: apps/web/public/fonts/NotoSansSC-Regular.ttf");
}

/** Always pass this when embedding — fontkit CJK subsetting is unsafe. */
export const CJK_EMBED_OPTIONS = { subset: false as const };
