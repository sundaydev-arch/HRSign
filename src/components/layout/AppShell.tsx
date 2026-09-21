"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@prisma/client";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function AppShell({
  role,
  userName,
  children,
}: {
  role: UserRole;
  userName: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-background">
      <div className="hidden lg:flex">
        <Sidebar role={role} userName={userName} />
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("closeMenu")}
            className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <Sidebar
            role={role}
            userName={userName}
            onNavigate={() => setOpen(false)}
            className="relative z-10 shadow-2xl"
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/80 bg-background/80 px-4 backdrop-blur-md lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("openMenu")}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <BrandLogo className="h-8 w-8 rounded-lg" />
          <span className="text-sm font-semibold tracking-tight">
            <span className="text-primary">HR</span>Sign
          </span>
        </header>
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
