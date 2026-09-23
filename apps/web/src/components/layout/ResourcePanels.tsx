import { Label } from "@/components/ui/label";
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
      <div className="flex flex-col gap-4">{children}</div>
      {actions}
    </Surface>
  );
}

/** Dashboard list shell with optional section title and filter toolbar. */
export function ListPanel({
  title,
  toolbar,
  children,
  className,
}: {
  title?: string;
  toolbar?: React.ReactNode;
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
      {toolbar ? (
        <div className="border-b border-border/60 bg-muted/30 px-3 py-3 sm:px-4">{toolbar}</div>
      ) : null}
      {children}
    </Surface>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-snug text-muted-foreground">{children}</p>;
}

/** Labeled field stack — prefer over placeholder-only inputs. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}
