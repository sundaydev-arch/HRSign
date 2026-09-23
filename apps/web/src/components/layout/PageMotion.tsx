"use client";

import { cn } from "@/lib/utils";

/** Soft page-enter wrapper — respects prefers-reduced-motion via CSS. */
export function PageMotion({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("page-enter", className)}>{children}</div>;
}
