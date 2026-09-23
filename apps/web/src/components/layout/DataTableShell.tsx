import { cn } from "@/lib/utils";

/**
 * Scrollable table shell for narrow viewports.
 * Keeps columns usable without horizontal page overflow.
 */
export function DataTableShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <div className="min-w-[44rem] md:min-w-0">{children}</div>
      </div>
    </div>
  );
}
