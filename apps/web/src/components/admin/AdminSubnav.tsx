"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/users", key: "users" as const },
  { href: "/admin/accounts", key: "accounts" as const },
  { href: "/admin/api-keys", key: "apiKeys" as const },
  { href: "/admin/webhooks", key: "webhooks" as const },
  { href: "/admin/settings", key: "settings" as const },
  { href: "/admin/policies", key: "policies" as const },
];

export function AdminSubnav() {
  const pathname = usePathname();
  const t = useTranslations("admin.nav");

  return (
    <nav className="-mx-1 mb-4 overflow-x-auto border-b border-border px-1">
      <ul className="flex min-w-max gap-1 pb-px">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "inline-flex h-9 items-center px-3 text-sm transition-colors",
                  active
                    ? "border-b-2 border-foreground font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
