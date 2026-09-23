import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30",
  {
    variants: {
      variant: {
        default: "border-primary/15 bg-primary/8 text-primary",
        secondary: "border-border bg-secondary text-secondary-foreground",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive",
        success: "border-success/25 bg-success/12 text-success",
        accent: "border-brand/20 bg-brand/10 text-brand",
        outline: "border-border bg-card text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
