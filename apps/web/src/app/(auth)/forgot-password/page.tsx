"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
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
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgot");
  const tc = useTranslations("common");
  const apiError = useApiError();
  const [sent, setSent] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().trim().min(1, t("emailRequired")).email(t("emailInvalid")),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: Values) {
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: values.email.trim() }),
      });
      setSent(true);
      toast.success(t("sentToast"));
    } catch (err) {
      toast.error(apiError(err));
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
        {sent ? (
          <p className="text-sm text-muted-foreground">{t("sentMessage")}</p>
        ) : (
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? tc("processing") : t("submit")}
              </Button>
            </form>
          </Form>
        )}
        <Link href="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
          {t("backToLogin")}
        </Link>
      </div>
    </div>
  );
}
