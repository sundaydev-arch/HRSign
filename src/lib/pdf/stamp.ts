import { PDFDocument, degrees, rgb, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { loadChineseFont } from "./font";

export interface StampImage {
  page: number; // 1-based
  x: number;
  y: number; // origin at the top-left corner of the page
  width: number;
  height: number;
  imageBytes: Buffer; // transparent PNG
}

export interface StampOptions {
  watermarkText?: string;
}

/**
 * PDF stamping engine: overlays transparent PNGs (company seal / handwritten
 * signature) onto a PDF at the given coordinates, and optionally draws a
 * global diagonal watermark. Returns new PDF bytes without overwriting the
 * source file.
 */
export async function stampPdf(
  pdfBytes: Buffer,
  stamps: StampImage[],
  options: StampOptions = {},
): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBytes);
  pdf.registerFontkit(fontkit);

  // Embed identical image bytes only once.
  const imageCache = new Map<string, PDFImage>();
  for (const stamp of stamps) {
    const pageIndex = stamp.page - 1;
    if (pageIndex < 0 || pageIndex >= pdf.getPageCount()) continue;
    const page = pdf.getPage(pageIndex);

    const cacheKey = stamp.imageBytes.toString("base64");
    let image = imageCache.get(cacheKey);
    if (!image) {
      image = await pdf.embedPng(stamp.imageBytes);
      imageCache.set(cacheKey, image);
    }

    page.drawImage(image, {
      x: stamp.x,
      y: page.getHeight() - stamp.y - stamp.height,
      width: stamp.width,
      height: stamp.height,
    });
  }

  if (options.watermarkText) {
    await drawWatermark(pdf, options.watermarkText);
  }

  return Buffer.from(await pdf.save());
}

async function drawWatermark(pdf: PDFDocument, text: string): Promise<void> {
  const font = await pdf.embedFont(await loadChineseFont());
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.max(18, Math.min(42, width * 0.045));
    page.drawText(text, {
      x: width * 0.14,
      y: height * 0.28,
      size,
      font,
      color: rgb(0.55, 0.55, 0.55),
      opacity: 0.15,
      rotate: degrees(35),
    });
  }
}
