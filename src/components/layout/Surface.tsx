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
        "overflow-hidden rounded-xl border border-border/80 bg-card shadow-panel",
        className,
      )}
    >
      {children}
    </div>
  );
}
