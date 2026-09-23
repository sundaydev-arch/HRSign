import { cn } from "@/lib/utils";

/** Consistent vertical rhythm for dashboard page stacks. */
export const PAGE_STACK_CLASS = "space-y-5 sm:space-y-6";

export function PageStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(PAGE_STACK_CLASS, className)}>{children}</div>;
}
