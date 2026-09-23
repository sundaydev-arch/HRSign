import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const webPublic = join(repoRoot, "apps/web/public");

// pdfjs-dist 声明在 apps/web/package.json，需从该目录解析依赖
const webRequire = createRequire(join(repoRoot, "apps/web", "package.json"));
const pkgDir = dirname(webRequire.resolve("pdfjs-dist/package.json"));
const src = join(pkgDir, "build", "pdf.worker.min.mjs");
const destDir = existsSync(webPublic) ? webPublic : join(process.cwd(), "public");
const dest = join(destDir, "pdf.worker.min.mjs");

mkdirSync(destDir, { recursive: true });
if (!existsSync(src)) {
  console.error(`[copy-pdf-worker] worker not found: ${src}`);
  process.exit(1);
}
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] copied -> ${dest}`);
