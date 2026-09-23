"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type AppLocale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LOCALE_OPTIONS: { value: AppLocale; selfName: string }[] = [
  { value: "zh-CN", selfName: "中文" },
  { value: "en", selfName: "English" },
];

export function LanguageSwitcher({
  className,
  tone = "default",
  align = "start",
}: {
  className?: string;
  tone?: "default" | "sidebar";
  align?: "start" | "end";
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("localeSwitch");

  async function switchTo(next: AppLocale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // Best-effort persist for logged-in users (401 ignored when anonymous).
    try {
      await fetch("/api/me/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
    } catch {
      // Cookie still drives UI locale.
    }
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={tone === "sidebar" ? "ghost" : "outline"}
          size="sm"
          className={cn(
            "h-8 gap-1.5 px-2.5 text-xs",
            tone === "sidebar" &&
              "w-full justify-start text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            className,
          )}
        >
          <Languages className="h-4 w-4" />
          {t("label")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {LOCALE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => void switchTo(option.value)}
            disabled={option.value === locale}
          >
            {option.selfName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
