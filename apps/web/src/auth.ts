import { authConfig } from "@/auth.config";
import { env, isOidcConfigured } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ROLE_OPTIONS, type SessionUser } from "@/lib/roles";
import type { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { rateLimitChecked } from "@/lib/rate-limit";
import type { Provider } from "next-auth/providers";

const providers: Provider[] = [
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

      const rl = rateLimitChecked({
        key: `login:${email}`,
        limit: 20,
        windowMs: 60_000,
      });
      if (!rl.ok) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive) return null;
      if (!user.passwordHash) return null;

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;

      return { id: user.id, name: user.fullName, email: user.email, role: user.role };
    },
  }),
];

if (isOidcConfigured()) {
  providers.push({
    id: "oidc",
    name: "OIDC",
    type: "oidc",
    issuer: env.OIDC_ISSUER,
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET,
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider !== "oidc") return true;
      const subject = account.providerAccountId;
      const email =
        (typeof profile?.email === "string" ? profile.email : user.email)?.toLowerCase() ?? null;
      if (!subject || !email) return false;

      let dbUser = await prisma.user.findFirst({
        where: { OR: [{ oidcSubject: subject }, { email }] },
      });
      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            email,
            fullName: user.name ?? email,
            oidcSubject: subject,
            role: "EMPLOYEE",
            isActive: true,
          },
        });
      } else if (!dbUser.oidcSubject) {
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: { oidcSubject: subject },
        });
      }
      if (!dbUser.isActive) return false;
      user.id = dbUser.id;
      (user as { role?: UserRole }).role = dbUser.role;
      user.name = dbUser.fullName;
      user.email = dbUser.email;
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        if (user.id) token.id = user.id;
        const role = (user as { role?: UserRole }).role;
        if (role) token.role = role;
        if (user.name) token.name = user.name;
        if (user.email) token.email = user.email;
      }
      if (trigger === "update" && session && typeof session === "object") {
        const patch = session as { name?: string };
        if (typeof patch.name === "string" && patch.name.trim()) {
          token.name = patch.name.trim();
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const su: SessionUser = {
          ...session.user,
          id: typeof token.id === "string" ? token.id : "",
          name: (typeof token.name === "string" ? token.name : session.user.name) ?? "",
          email: (typeof token.email === "string" ? token.email : session.user.email) ?? "",
          role: ROLE_OPTIONS.find((r) => r.value === token.role)?.value ?? "EMPLOYEE",
        };
        return { ...session, user: su };
      }
      return session;
    },
  },
});

/** Whether the login page should show the OIDC button. */
export function oidcEnabled(): boolean {
  return isOidcConfigured();
}
