import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/** A4 points (pdf-lib default). */
export const A4 = { width: 595.28, height: 841.89 } as const;

/**
 * Build a blank multi-page A4 PDF for online template creation.
 * Light guide margins help HR place fields; not printed as content.
 */
export async function createBlankA4Pdf(pageCount = 1): Promise<Buffer> {
  const pages = Math.min(20, Math.max(1, Math.round(pageCount)));
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([A4.width, A4.height]);
    // Soft margin guides (very light) so the canvas isn't a featureless white void.
    const guide = rgb(0.88, 0.86, 0.82);
    const inset = 48;
    page.drawRectangle({
      x: inset,
      y: inset,
      width: A4.width - inset * 2,
      height: A4.height - inset * 2,
      borderColor: guide,
      borderWidth: 0.75,
    });
    page.drawText(`Page ${i + 1}`, {
      x: inset,
      y: 28,
      size: 8,
      font,
      color: rgb(0.7, 0.68, 0.64),
    });
  }

  return Buffer.from(await doc.save());
}
