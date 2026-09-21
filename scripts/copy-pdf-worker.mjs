import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("pdfjs-dist/package.json"));
const src = join(pkgDir, "build", "pdf.worker.min.mjs");
const destDir = join(process.cwd(), "public");
const dest = join(destDir, "pdf.worker.min.mjs");

mkdirSync(destDir, { recursive: true });
if (!existsSync(src)) {
  console.error(`[copy-pdf-worker] worker not found: ${src}`);
  process.exit(1);
}
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] copied -> ${dest}`);
