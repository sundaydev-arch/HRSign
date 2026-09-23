import { Surface } from "@/components/layout/Surface";
import { cn } from "@/lib/utils";

/** Dashboard create form shell — title, optional hint, fields, primary action. */
export function CreatePanel({
  title,
  hint,
  children,
  actions,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <Surface className={cn("space-y-4 p-4 sm:p-5", className)}>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {hint ? (
          <p className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{hint}</p>
        ) : null}
      </div>
      {children}
      {actions}
    </Surface>
  );
}

/** Dashboard list shell with optional section title above a table. */
export function ListPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Surface className={cn("overflow-hidden", className)}>
      {title ? (
        <div className="border-b border-border/60 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        </div>
      ) : null}
      {children}
    </Surface>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-snug text-muted-foreground">{children}</p>;
}
