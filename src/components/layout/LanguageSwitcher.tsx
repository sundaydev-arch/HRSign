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

// Language autonyms (中文 / English) are conventionally shown in their own
// language and are therefore not translated.
const LOCALE_OPTIONS: { value: AppLocale; selfName: string }[] = [
  { value: "zh-CN", selfName: "中文" },
  { value: "en", selfName: "English" },
];

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("localeSwitch");

  function switchTo(next: AppLocale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 px-2.5 text-xs", className)}>
          <Languages className="h-4 w-4" />
          {t("label")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {LOCALE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => switchTo(option.value)}
            disabled={option.value === locale}
          >
            {option.selfName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
