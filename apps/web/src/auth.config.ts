import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe configuration: no Prisma / bcrypt imports; used by the middleware.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
