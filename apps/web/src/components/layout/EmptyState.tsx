import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

/**
 * Quiet empty placeholder for lists / panels.
 * Prefer title + short hint; action is optional (CTA button or link).
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Tighter padding for table cells / inline panels */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col items-center text-center",
        compact ? "gap-2 px-2 py-6" : "gap-3 px-4 py-12",
        className,
      )}
      role="status"
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-muted-foreground",
          compact ? "h-10 w-10" : "h-12 w-12",
        )}
      >
        <Icon className={compact ? "h-[18px] w-[18px]" : "h-5 w-5"} aria-hidden />
      </div>
      <div className="space-y-1">
        <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-sm")}>
          {title}
        </p>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground text-balance">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
