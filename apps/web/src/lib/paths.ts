import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root (contains pnpm-workspace.yaml) or cwd fallback. */
export function repoRoot(): string {
  const fromEnv = process.env.HRSIGN_ROOT;
  if (fromEnv && existsSync(join(fromEnv, "pnpm-workspace.yaml"))) return fromEnv;
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** Next app root (`apps/web`). */
export function webRoot(): string {
  const root = repoRoot();
  const web = join(root, "apps/web");
  if (existsSync(join(web, "package.json"))) return web;
  // Running with cwd already inside apps/web
  if (existsSync(join(process.cwd(), "next.config.mjs"))) return process.cwd();
  return web;
}

export function webPublicDir(): string {
  return join(webRoot(), "public");
}

/** For scripts that live under scripts/ and use import.meta.url */
export function repoRootFromScript(metaUrl: string): string {
  return join(dirname(fileURLToPath(metaUrl)), "..");
}
