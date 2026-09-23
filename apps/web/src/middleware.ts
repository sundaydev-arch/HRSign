import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge safety: import only auth.config.ts (no Prisma / bcrypt).
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: [
    // API routes authorize themselves (session cookie or API key).
    // Public SEO/GEO + auth + short-sign surfaces must not redirect to login.
    "/((?!api/|_next/static|_next/image|favicon.ico|pdf.worker.min.mjs|login|forgot-password|reset-password|invite|sign/external|sign/envelope|s/|robots\\.txt|sitemap\\.xml|llms\\.txt|\\.well-known).*)",
  ],
};
