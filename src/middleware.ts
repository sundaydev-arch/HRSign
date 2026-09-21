import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge safety: import only auth.config.ts (no Prisma / bcrypt).
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: [
    // API routes (auth/files/external) authorize themselves inside the route,
    // not via middleware session redirects.
    // .well-known includes Chrome DevTools probe paths and must not redirect.
    "/((?!api/auth|api/sign/external|api/files|_next/static|_next/image|favicon.ico|pdf.worker.min.mjs|login|sign/external|\\.well-known).*)",
  ],
};
