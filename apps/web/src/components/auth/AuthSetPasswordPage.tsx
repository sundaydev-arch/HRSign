"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { AuthFormSkeleton } from "@/components/layout/skeletons";
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
import { api } from "@/lib/client";
import { useApiError } from "@/lib/use-api-error";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

function SetPasswordForm({ purpose }: { purpose: "INVITE" | "PASSWORD_RESET" }) {
  const ns = purpose === "INVITE" ? "auth.invite" : "auth.reset";
  const t = useTranslations(ns);
  const tc = useTranslations("common");
  const apiError = useApiError();
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") ?? "";

  const schema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(8, t("passwordTooShort")),
          confirm: z.string().min(1, t("passwordMismatch")),
        })
        .refine((v) => v.password === v.confirm, {
          path: ["confirm"],
          message: t("passwordMismatch"),
        }),
    [t],
  );
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: Values) {
    if (!token) {
      toast.error(t("tokenMissing"));
      return;
    }
    try {
      await api("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ token, password: values.password, purpose }),
      });
      toast.success(t("successToast"));
      router.push("/login");
    } catch (err) {
      toast.error(apiError(err, "AUTH_TOKEN_INVALID"));
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 shadow-panel">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-9 w-9 rounded-lg" />
          <div>
            <div className="font-semibold tracking-tight">HRSign</div>
            <div className="text-xs text-muted-foreground">{t("subtitle")}</div>
          </div>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        {!token ? (
          <p className="text-sm text-destructive">{t("tokenMissing")}</p>
        ) : null}
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("password")}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("confirm")}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting || !token}
            >
              {form.formState.isSubmitting ? tc("processing") : t("submit")}
            </Button>
          </form>
        </Form>
        <Link href="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
          {t("backToLogin")}
        </Link>
      </div>
    </div>
  );
}

export function AuthSetPasswordPage({ purpose }: { purpose: "INVITE" | "PASSWORD_RESET" }) {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <SetPasswordForm purpose={purpose} />
    </Suspense>
  );
}
