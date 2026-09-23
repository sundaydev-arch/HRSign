"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";

/** Stage-1/2 crypto disclaimer for seal & sign surfaces. */
export function SignatureDisclaimer({ variant = "default" }: { variant?: "default" | "compact" }) {
  const t = useTranslations("signing.disclaimer");
  return (
    <Alert className={variant === "compact" ? "py-2" : undefined}>
      <AlertDescription className="text-xs text-muted-foreground">{t("body")}</AlertDescription>
    </Alert>
  );
}
