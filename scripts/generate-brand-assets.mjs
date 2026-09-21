/**
 * Generate PNG and ICO assets from the brand SVG source files.
 *
 * Requires sharp (available as a transitive dependency of Next.js).
 * Usage: node scripts/generate-brand-assets.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const brandDir = resolve(projectRoot, "public", "brand");

// Resolve sharp from the pnpm virtual store (Next.js transitive dependency).
const sharpPath = resolve(projectRoot, "node_modules", ".pnpm", "sharp@0.33.5", "node_modules", "sharp", "lib", "index.js");
const sharp = (await import(sharpPath)).default;

const iconSvg = readFileSync(resolve(brandDir, "logo-icon.svg"), "utf-8");

const PNG_SIZES = [16, 32, 48, 128, 256];
const ICO_SIZES = [16, 32, 48];

async function generatePngs() {
  for (const size of PNG_SIZES) {
    const outPath = resolve(brandDir, `favicon-${size}.png`);
    await sharp(Buffer.from(iconSvg))
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`  ✓ favicon-${size}.png`);
  }

  // Large app icons
  for (const size of [128, 256]) {
    const outPath = resolve(brandDir, `icon-${size}.png`);
    await sharp(Buffer.from(iconSvg))
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`  ✓ icon-${size}.png`);
  }
}

async function generateIco() {
  // Build a multi-size ICO file from PNG buffers.
  // ICO format: 6-byte header + 16-byte directory entries + PNG data.
  const pngBuffers = [];
  for (const size of ICO_SIZES) {
    const buf = await sharp(Buffer.from(iconSvg))
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buf });
  }

  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * ICO_SIZES.length;
  let dataOffset = headerSize + dirSize;

  // Header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = ICO
  header.writeUInt16LE(ICO_SIZES.length, 4); // count

  const dirEntries = [];
  for (const { size, buf } of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // image data size
    entry.writeUInt32LE(dataOffset, 12); // offset to image data
    dirEntries.push(entry);
    dataOffset += buf.length;
  }

  const ico = Buffer.concat([header, ...dirEntries, ...pngBuffers.map((p) => p.buf)]);
  const icoPath = resolve(brandDir, "favicon.ico");
  writeFileSync(icoPath, ico);
  console.log(`  ✓ favicon.ico (${ICO_SIZES.length} sizes)`);
}

// Main
const svgExists = existsSync(resolve(brandDir, "logo-icon.svg"));
if (!svgExists) {
  console.error("Source SVG not found. Run this script from the project root.");
  process.exit(1);
}

console.log("Generating brand PNG assets...");
await generatePngs();

console.log("Generating favicon.ico...");
await generateIco();

console.log("Done. All brand assets are in public/brand/.");
