"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileCheck2, PenLine, ShieldCheck } from "lucide-react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth.login");
  const tApp = useTranslations("app");
  const [oidcAvailable, setOidcAvailable] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .trim()
          .min(1, t("errorRequired"))
          .email(t("errorRequired")),
        password: z.string().min(1, t("errorRequired")),
      }),
    [t],
  );

  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    void fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((providers: Record<string, unknown>) => {
        setOidcAvailable(Boolean(providers.oidc));
      })
      .catch(() => setOidcAvailable(false));
  }, []);

  async function onSubmit(values: Values) {
    const res = await signIn("credentials", {
      redirect: false,
      email: values.email.trim(),
      password: values.password,
    });
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

  const loading = form.formState.isSubmitting;

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden text-white login-hero-grid lg:flex">
        <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-10 w-10 rounded-xl" />
            <div>
              <div className="text-base font-semibold tracking-tight">HRSign</div>
              <div className="text-sm text-white/55">{tApp("tagline")}</div>
            </div>
          </div>

          <div className="max-w-lg space-y-7">
            <div className="h-1 w-10 rounded-sm bg-white/35" />
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
              {t("heroEyebrow")}
            </p>
            <h1 className="text-balance text-[2.65rem] font-semibold leading-[1.12] tracking-tight xl:text-[3rem]">
              {t("heroTitle")}
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-white/65">{t("heroSubtitle")}</p>
            <ul className="space-y-3 pt-1">
              {features.map((feature) => (
                <li key={feature.text} className="flex items-center gap-3 text-sm text-white/80">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10">
                    <feature.icon className="h-3.5 w-3.5 text-white/80" />
                  </span>
                  <span className="leading-snug">{feature.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/35">{tApp("metadataDescription")}</p>
        </div>
      </aside>

      <div className="relative flex flex-col bg-background">
        <div className="absolute right-6 top-6">
          <LanguageSwitcher align="end" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
          <div className="page-enter w-full max-w-[24rem] rounded-xl border border-border bg-card p-6 shadow-panel sm:p-8">
            <div className="mb-8">
              <BrandLogo className="mb-5 h-11 w-11 rounded-xl lg:hidden" />
              <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>
            {oidcAvailable ? (
              <div className="mb-5 space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => void signIn("oidc", { callbackUrl: "/tasks" })}
                >
                  {t("oidcButton")}
                </Button>
                <div className="relative text-center text-xs text-muted-foreground">
                  <span className="relative z-10 bg-card px-2">{t("orDivider")}</span>
                  <span className="absolute inset-x-0 top-1/2 border-t border-border" />
                </div>
              </div>
            ) : null}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("email")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@company.com"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>{t("password")}</FormLabel>
                        <Link
                          href="/forgot-password"
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {t("forgotPassword")}
                        </Link>
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t("passwordPlaceholder")}
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? t("submitting") : t("submit")}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
