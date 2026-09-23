"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { PageMotion } from "@/components/layout/PageMotion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { UserRole } from "@prisma/client";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "HR_SIGN_SIDEBAR_COLLAPSED";

/** Full-bleed document surfaces (e.g. template editor) — no max-width padding. */
function isImmersivePath(pathname: string): boolean {
  return /^\/templates\/[^/]+\/edit\/?$/.test(pathname);
}

export function AppShell({
  role,
  userName,
  userEmail,
  children,
}: {
  role: UserRole;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const immersive = isImmersivePath(pathname);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  function toggleCollapsed() {
    if (immersive) return;
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const railCollapsed = immersive || collapsed;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-svh overflow-hidden bg-background">
        <div className="hidden h-full shrink-0 lg:flex">
          <Sidebar
            role={role}
            userName={userName}
            userEmail={userEmail}
            collapsed={railCollapsed}
            onToggleCollapse={toggleCollapsed}
          />
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="left"
            className="w-[min(18rem,88vw)] gap-0 border-sidebar-border bg-sidebar p-0 sm:max-w-none [&>button]:right-3 [&>button]:top-3"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{t("openMenu")}</SheetTitle>
              <SheetDescription>{t("workspace")}</SheetDescription>
            </SheetHeader>
            <Sidebar
              role={role}
              userName={userName}
              userEmail={userEmail}
              onNavigate={() => setOpen(false)}
              className="h-full w-full border-0"
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-background/85 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-4 lg:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="pressable shrink-0"
              aria-label={t("openMenu")}
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <BrandLogo className="h-8 w-8 rounded-lg" />
            <span className="truncate text-sm font-semibold tracking-tight">HRSign</span>
          </header>
          <main
            className={cn(
              "min-h-0 min-w-0 flex-1",
              immersive ? "overflow-hidden" : "overflow-y-auto",
            )}
          >
            <div
              className={cn(
                immersive
                  ? "flex h-full min-h-0 w-full flex-col"
                  : "mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6",
              )}
            >
              <PageMotion className={cn(immersive && "flex min-h-0 flex-1 flex-col")}>
                {children}
              </PageMotion>
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
