import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/** Inline spinner for buttons / inline busy states. */
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("h-4 w-4 animate-spin", className)}
      aria-hidden
    />
  );
}
