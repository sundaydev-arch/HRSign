import { cn } from "@/lib/utils";

/** Soft shimmer bone — Quiet Precision slate palette. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md", className)}
      aria-hidden
      {...props}
    />
  );
}
