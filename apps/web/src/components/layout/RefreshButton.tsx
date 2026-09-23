"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function RefreshButton({
  onClick,
  refreshing,
  label,
  className,
}: {
  onClick: () => void;
  refreshing: boolean;
  label: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      loading={refreshing}
      aria-busy={refreshing}
      onClick={onClick}
    >
      {!refreshing ? <RefreshCw className="mr-1 h-4 w-4" /> : null}
      {label}
    </Button>
  );
}
