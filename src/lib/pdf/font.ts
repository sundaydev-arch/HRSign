import fs from "node:fs/promises";
import path from "node:path";

let cachedFont: Buffer | null = null;

/**
 * Load the CJK font (Noto Sans SC); pdf-lib standard fonts lack CJK glyphs.
 */
export async function loadChineseFont(): Promise<Buffer> {
    if (cachedFont) return cachedFont;
    const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansSC-Regular.otf");
    cachedFont = await fs.readFile(fontPath);
    return cachedFont;
}
