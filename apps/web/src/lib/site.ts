/**
 * Public site URL helpers for SEO metadata, sitemap, and robots.
 * Prefer APP_URL; fall back to NEXTAUTH_URL / localhost for local/dev.
 */
export function getSiteUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
