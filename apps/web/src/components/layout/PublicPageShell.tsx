import { BrandLogo } from "@/components/brand/BrandLogo";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for unauthenticated / signer-facing pages.
 * `narrow` = single column (PowerForm, Clickwrap, hosted sign).
 * `wide` = document + sidebar layouts (external task sign).
 */
export function PublicPageShell({
  variant = "narrow",
  badge,
  children,
  className,
}: {
  variant?: "narrow" | "wide";
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-svh bg-background",
        variant === "narrow" ? "px-4 py-8 sm:px-6" : "px-4 py-6 sm:px-6 lg:px-8",
        className,
      )}
    >
      <header
        className={cn(
          "mx-auto mb-6 flex items-center justify-between gap-3",
          variant === "narrow" ? "max-w-lg" : "max-w-6xl",
        )}
      >
        <div className="flex items-center gap-2.5">
          <BrandLogo className="h-8 w-8 shrink-0 rounded-lg" />
          <span className="text-sm font-semibold tracking-tight">HRSign</span>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </header>
      <main
        id="main"
        className={cn(
          "mx-auto",
          variant === "narrow" ? "max-w-lg space-y-4" : "max-w-6xl",
        )}
      >
        {children}
      </main>
    </div>
  );
}
