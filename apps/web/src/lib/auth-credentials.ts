import { DEFAULT_LOCALE, toAppLocale, type AppLocale } from "@/i18n/config";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { generateCredentialToken, hashToken } from "@/lib/tokens";
import { sendEmail } from "@/server/providers";
import type { AuthCredentialPurpose, UserLocale } from "@prisma/client";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

const COPY: Record<
  AppLocale,
  {
    inviteSubject: string;
    resetSubject: string;
    inviteTitle: string;
    resetTitle: string;
    hello: (name: string) => string;
    inviteBody: string;
    resetBody: string;
    inviteCta: string;
    resetCta: string;
    expiry: (when: string) => string;
  }
> = {
  "zh-CN": {
    inviteSubject: "【HRSign】邀请您设置登录密码",
    resetSubject: "【HRSign】重置登录密码",
    inviteTitle: "欢迎使用 HRSign",
    resetTitle: "重置密码",
    hello: (name) => `你好，${name}：`,
    inviteBody: "管理员已为你创建账号，请点击下方按钮设置登录密码。",
    resetBody: "我们收到了你的密码重置请求。若非本人操作，请忽略本邮件。",
    inviteCta: "设置密码",
    resetCta: "重置密码",
    expiry: (when) => `链接有效期至 ${when}。请勿转发。`,
  },
  en: {
    inviteSubject: "[HRSign] Set your login password",
    resetSubject: "[HRSign] Reset your password",
    inviteTitle: "Welcome to HRSign",
    resetTitle: "Reset password",
    hello: (name) => `Hi ${name},`,
    inviteBody: "An admin created an account for you. Click below to set your login password.",
    resetBody: "We received a password reset request. If this was not you, ignore this email.",
    inviteCta: "Set password",
    resetCta: "Reset password",
    expiry: (when) => `This link expires at ${when}. Do not forward it.`,
  },
};

export async function issueCredentialToken(opts: {
  userId: string;
  purpose: AuthCredentialPurpose;
  email: string;
  fullName: string;
  locale?: UserLocale | AppLocale | null;
}): Promise<void> {
  const plaintext = generateCredentialToken();
  const tokenHash = hashToken(plaintext);
  const ttl = opts.purpose === "INVITE" ? INVITE_TTL_MS : RESET_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);

  await prisma.authCredentialToken.updateMany({
    where: { userId: opts.userId, purpose: opts.purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.authCredentialToken.create({
    data: {
      userId: opts.userId,
      purpose: opts.purpose,
      tokenHash,
      expiresAt,
    },
  });

  let locale: AppLocale = DEFAULT_LOCALE;
  if (opts.locale) {
    locale = opts.locale === "zh-CN" || opts.locale === "en" ? opts.locale : toAppLocale(opts.locale);
  } else {
    const user = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { locale: true },
    });
    if (user?.locale) locale = toAppLocale(user.locale);
  }

  const copy = COPY[locale];
  const path = opts.purpose === "INVITE" ? "invite" : "reset-password";
  const href = `${env.APP_URL}/${path}?token=${encodeURIComponent(plaintext)}`;
  const isInvite = opts.purpose === "INVITE";
  const when = expiresAt.toLocaleString(locale === "en" ? "en-US" : "zh-CN");
  const html = `
  <div style="max-width:560px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;color:#1c1917;">
    <h2 style="font-size:18px;">${isInvite ? copy.inviteTitle : copy.resetTitle}</h2>
    <p style="font-size:14px;line-height:1.7;">${copy.hello(opts.fullName)}</p>
    <p style="font-size:14px;line-height:1.7;">${isInvite ? copy.inviteBody : copy.resetBody}</p>
    <p style="margin:24px 0;">
      <a href="${href}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;">
        ${isInvite ? copy.inviteCta : copy.resetCta}
      </a>
    </p>
    <p style="font-size:12px;color:#78716c;">${copy.expiry(when)}</p>
  </div>`;

  await sendEmail({
    to: opts.email,
    subject: isInvite ? copy.inviteSubject : copy.resetSubject,
    html,
  });
}

export async function consumeCredentialToken(opts: {
  plaintext: string;
  purpose: AuthCredentialPurpose;
}): Promise<{ userId: string; email: string; fullName: string }> {
  const tokenHash = hashToken(opts.plaintext);
  const row = await prisma.authCredentialToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, fullName: true, isActive: true } } },
  });
  if (
    !row ||
    row.purpose !== opts.purpose ||
    row.usedAt ||
    row.expiresAt <= new Date() ||
    !row.user.isActive
  ) {
    throw new Error("INVALID_CREDENTIAL_TOKEN");
  }
  await prisma.authCredentialToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return { userId: row.user.id, email: row.user.email, fullName: row.user.fullName };
}
