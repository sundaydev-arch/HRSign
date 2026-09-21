"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";
import {
  Archive,
  FileSignature,
  LayoutList,
  LogOut,
  ScrollText,
  Stamp,
  Users,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLabelKey = "templates" | "tasks" | "archive" | "seals" | "auditLogs" | "userManagement";

interface NavItem {
  href: string;
  labelKey: NavLabelKey;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/templates", labelKey: "templates", icon: LayoutList, roles: ["SUPER_ADMIN", "HR"] },
  { href: "/tasks", labelKey: "tasks", icon: FileSignature, roles: ["SUPER_ADMIN", "HR", "DEPT_LEADER", "EMPLOYEE"] },
  { href: "/archive", labelKey: "archive", icon: Archive, roles: ["SUPER_ADMIN", "HR", "DEPT_LEADER", "EMPLOYEE"] },
  { href: "/seals", labelKey: "seals", icon: Stamp, roles: ["SUPER_ADMIN", "HR"] },
  { href: "/audit-logs", labelKey: "auditLogs", icon: ScrollText, roles: ["SUPER_ADMIN", "HR"] },
  { href: "/admin/users", labelKey: "userManagement", icon: Users, roles: ["SUPER_ADMIN"] },
];

export function Sidebar({
  role,
  userName,
  onNavigate,
  className,
}: {
  role: UserRole;
  userName: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const roleLabel = t("role", { role });
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={cn(
        "flex h-svh w-[16.5rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-5 py-6">
        <BrandLogo className="h-9 w-9 shrink-0 rounded-[10px] shadow-sm" />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-tight tracking-tight">
            <span className="text-primary">HR</span>Sign
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{tApp("tagline")}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-sidebar-border p-4">
        <LanguageSwitcher />
        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-muted/50 px-2.5 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {userName.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{userName}</div>
            <div className="truncate text-xs text-muted-foreground">{roleLabel}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {t("signOut")}
        </button>
      </div>
    </aside>
  );
}
