import { cn } from "@/lib/utils";

export function Surface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-panel surface-lift",
        className,
      )}
    >
      {children}
    </div>
  );
}
