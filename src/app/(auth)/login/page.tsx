"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileCheck2, PenLine, ShieldCheck } from "lucide-react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth.login");
  const tApp = useTranslations("app");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error(t("errorRequired"));
      return;
    }
    setLoading(true);
    const res = await signIn("credentials", { redirect: false, email: email.trim(), password });
    setLoading(false);
    if (res?.error) {
      toast.error(t("errorInvalid"));
      return;
    }
    router.push("/tasks");
    router.refresh();
  }

  const features = [
    { icon: PenLine, text: t("featureSign") },
    { icon: FileCheck2, text: t("featureSeal") },
    { icon: ShieldCheck, text: t("featureAudit") },
  ];

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground login-hero-grid lg:flex">
        <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-10 w-10 rounded-xl ring-2 ring-white/20" />
            <div>
              <div className="text-lg font-semibold tracking-tight">HRSign</div>
              <div className="text-sm text-white/70">{tApp("tagline")}</div>
            </div>
          </div>

          <div className="max-w-md space-y-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">
              {t("heroEyebrow")}
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight xl:text-[2.5rem]">
              {t("heroTitle")}
            </h1>
            <p className="text-base leading-relaxed text-white/75">{t("heroSubtitle")}</p>
            <ul className="space-y-3 pt-2">
              {features.map((feature) => (
                <li
                  key={feature.text}
                  className="flex items-center gap-3 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm backdrop-blur-sm"
                >
                  <feature.icon className="h-4 w-4 shrink-0 text-white" />
                  {feature.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/50">{tApp("metadataDescription")}</p>
        </div>
      </aside>

      <div className="relative flex flex-col bg-background">
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-[22.5rem]">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <BrandLogo className="mb-5 h-12 w-12 rounded-2xl shadow-panel lg:hidden" />
                <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
              </div>
              <LanguageSwitcher className="shrink-0" />
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="h-10 w-full" disabled={loading}>
                {loading ? t("submitting") : t("submit")}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
