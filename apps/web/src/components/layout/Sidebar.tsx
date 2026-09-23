"use client";

import { AccountProfileDialog } from "@/components/layout/AccountProfileDialog";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LOCALE_COOKIE, type AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";
import {
  Archive,
  Building2,
  ChevronsRight,
  DoorOpen,
  FileCheck2,
  FileInput,
  FileSignature,
  FileStack,
  FolderKanban,
  KeyRound,
  Languages,
  Layers,
  LayoutDashboard,
  LayoutList,
  Link2,
  LogOut,
  MoreVertical,
  PanelLeftClose,
  Scale,
  ScrollText,
  Settings,
  Stamp,
  UserRound,
  Users,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type NavLabelKey =
  | "dashboard"
  | "envelopes"
  | "powerforms"
  | "bulkSend"
  | "clickwraps"
  | "rooms"
  | "clm"
  | "notary"
  | "templates"
  | "tasks"
  | "archive"
  | "seals"
  | "auditLogs"
  | "userManagement"
  | "accounts"
  | "apiKeys"
  | "webhooks"
  | "settings";

interface NavItem {
  href: string;
  labelKey: NavLabelKey;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const WORKFLOW_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "HR", "DEPT_LEADER", "EMPLOYEE"],
  },
  {
    href: "/tasks",
    labelKey: "tasks",
    icon: FileSignature,
    roles: ["SUPER_ADMIN", "HR", "DEPT_LEADER", "EMPLOYEE"],
  },
  { href: "/templates", labelKey: "templates", icon: LayoutList, roles: ["SUPER_ADMIN", "HR"] },
  {
    href: "/archive",
    labelKey: "archive",
    icon: Archive,
    roles: ["SUPER_ADMIN", "HR", "DEPT_LEADER", "EMPLOYEE"],
  },
];

/** DocuSign-style envelope tools — HR / admin only (employees use Signing Tasks). */
const ESIGN_ITEMS: NavItem[] = [
  {
    href: "/envelopes",
    labelKey: "envelopes",
    icon: FileStack,
    roles: ["SUPER_ADMIN", "HR"],
  },
  {
    href: "/powerforms",
    labelKey: "powerforms",
    icon: FileInput,
    roles: ["SUPER_ADMIN", "HR"],
  },
  {
    href: "/bulk-send",
    labelKey: "bulkSend",
    icon: Layers,
    roles: ["SUPER_ADMIN", "HR"],
  },
];

const PRODUCT_ITEMS: NavItem[] = [
  {
    href: "/clickwraps",
    labelKey: "clickwraps",
    icon: FileCheck2,
    roles: ["SUPER_ADMIN", "HR"],
  },
  {
    href: "/rooms",
    labelKey: "rooms",
    icon: DoorOpen,
    roles: ["SUPER_ADMIN", "HR"],
  },
  {
    href: "/clm",
    labelKey: "clm",
    icon: FolderKanban,
    roles: ["SUPER_ADMIN", "HR"],
  },
  {
    href: "/notary",
    labelKey: "notary",
    icon: Scale,
    roles: ["SUPER_ADMIN", "HR"],
  },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/seals", labelKey: "seals", icon: Stamp, roles: ["SUPER_ADMIN", "HR"] },
  { href: "/audit-logs", labelKey: "auditLogs", icon: ScrollText, roles: ["SUPER_ADMIN", "HR"] },
  { href: "/admin/users", labelKey: "userManagement", icon: Users, roles: ["SUPER_ADMIN"] },
  { href: "/admin/accounts", labelKey: "accounts", icon: Building2, roles: ["SUPER_ADMIN"] },
  { href: "/admin/api-keys", labelKey: "apiKeys", icon: KeyRound, roles: ["SUPER_ADMIN"] },
  { href: "/admin/webhooks", labelKey: "webhooks", icon: Link2, roles: ["SUPER_ADMIN"] },
  { href: "/admin/settings", labelKey: "settings", icon: Settings, roles: ["SUPER_ADMIN"] },
];

const LOCALE_OPTIONS: { value: AppLocale; selfName: string }[] = [
  { value: "zh-CN", selfName: "中文" },
  { value: "en", selfName: "English" },
];

function NavLink({
  item,
  active,
  onNavigate,
  label,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  label: string;
  collapsed?: boolean;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-[13.5px] transition-colors duration-150",
        collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
      )}
    >
      {active && !collapsed ? (
        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand transition-transform duration-200" />
      ) : null}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-200",
          active ? "text-foreground" : "opacity-80 group-hover:opacity-100",
          "group-hover:scale-105",
        )}
      />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({
  role,
  userName,
  userEmail,
  onNavigate,
  className,
  collapsed = false,
  onToggleCollapse,
}: {
  role: UserRole;
  userName: string;
  userEmail: string;
  onNavigate?: () => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const tLocale = useTranslations("localeSwitch");
  const roleLabel = t("role", { role });
  const workflow = WORKFLOW_ITEMS.filter((item) => item.roles.includes(role));
  const esign = ESIGN_ITEMS.filter((item) => item.roles.includes(role));
  const products = PRODUCT_ITEMS.filter((item) => item.roles.includes(role));
  const admin = ADMIN_ITEMS.filter((item) => item.roles.includes(role));
  const [displayName, setDisplayName] = useState(userName);
  const [profileOpen, setProfileOpen] = useState(false);
  const initials = displayName.slice(0, 1) || userEmail.slice(0, 1) || "?";

  useEffect(() => {
    setDisplayName(userName);
  }, [userName]);

  async function switchLocale(next: AppLocale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
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

  function renderSection(sectionKey: "workflow" | "esign" | "products" | "admin", items: NavItem[]) {
    if (items.length === 0) return null;
    return (
      <div className="flex flex-col gap-1">
        {!collapsed ? (
          <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
            {t(sectionKey)}
          </p>
        ) : null}
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            label={t(item.labelKey)}
            onNavigate={onNavigate}
            collapsed={collapsed}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          />
        ))}
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "flex h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-[15.75rem]",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center pb-4 pt-5",
          collapsed ? "flex-col gap-1 px-1.5" : "gap-2 px-3",
        )}
      >
        <BrandLogo className="h-8 w-8 shrink-0 rounded-[10px]" />
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold leading-tight tracking-tight">HRSign</div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{tApp("tagline")}</div>
          </div>
        ) : null}
        {onToggleCollapse ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                aria-expanded={!collapsed}
                aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              >
                {collapsed ? (
                  <ChevronsRight className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {collapsed ? t("expandSidebar") : t("collapseSidebar")}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <ScrollArea className={cn("min-h-0 flex-1", collapsed ? "px-1.5" : "px-3")}>
        <nav className="flex flex-col gap-6 pb-4">
          {renderSection("workflow", workflow)}
          {renderSection("esign", esign)}
          {renderSection("products", products)}
          {renderSection("admin", admin)}
        </nav>
      </ScrollArea>

      <div className="mt-auto flex flex-col gap-1 p-2">
        <Separator className="mb-1 bg-sidebar-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              aria-label={t("accountMenu")}
              title={collapsed ? displayName : undefined}
              className={cn(
                "pressable h-auto w-full text-left font-normal hover:bg-sidebar-accent",
                collapsed ? "justify-center px-1 py-2" : "justify-start gap-2 px-2 py-2",
              )}
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-foreground text-[12px] font-semibold text-background">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed ? (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium leading-tight">{displayName}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{userEmail}</div>
                  </div>
                  <MoreVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 rounded-lg"
            side="top"
            align={collapsed ? "center" : "start"}
            sideOffset={8}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-foreground text-[12px] font-semibold text-background">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium leading-tight">{displayName}</div>
                  <div className="truncate text-xs text-muted-foreground">{roleLabel}</div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Languages className="h-4 w-4" />
                {tLocale("label")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {LOCALE_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    disabled={option.value === locale}
                    onClick={() => void switchLocale(option.value)}
                  >
                    {option.selfName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setProfileOpen(true);
              }}
            >
              <UserRound className="h-4 w-4" />
              {t("editProfile")}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/forgot-password" onClick={onNavigate}>
                <KeyRound className="h-4 w-4" />
                {t("changePassword")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut({ callbackUrl: "/login" })}>
              <LogOut className="h-4 w-4" />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AccountProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          initialName={displayName}
          initialEmail={userEmail}
          onSaved={(name) => {
            setDisplayName(name);
            router.refresh();
          }}
        />
      </div>
    </aside>
  );
}
