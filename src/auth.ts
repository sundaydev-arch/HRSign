import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { ROLE_OPTIONS, type SessionUser } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;
        // OIDC users have no password; compare only for email/password login.
        if (!user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, name: user.fullName, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        if (user.id) token.id = user.id;
        // NextAuth types do not carry the custom role; at runtime it comes
        // from the authorize return value (same boundary-assertion pattern as
        // SessionUser in rbac.ts).
        const role = (user as { role?: UserRole }).role;
        if (role) token.role = role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        // No type assertion: spread user fields and explicitly fill id/role
        // (isomorphic to SessionUser in rbac.ts).
        const su: SessionUser = {
          ...session.user,
          id: typeof token.id === "string" ? token.id : "",
          name: session.user.name ?? "",
          role: ROLE_OPTIONS.find((r) => r.value === token.role)?.value ?? "EMPLOYEE",
        };
        return { ...session, user: su };
      }
      return session;
    },
  },
});
