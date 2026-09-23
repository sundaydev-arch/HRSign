"use client";

import { cn } from "@/lib/utils";
import { Stamp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Seal thumbnail — shows a placeholder when the PNG is missing or effectively blank (e.g. 1×1 E2E stubs). */
export function SealPreview({
  storageKey,
  alt,
  className,
}: {
  storageKey: string;
  alt: string;
  className?: string;
}) {
  const t = useTranslations("seals");
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div
        className={cn(
          "flex h-14 w-20 flex-col items-center justify-center gap-0.5 rounded border border-dashed bg-muted/40 text-muted-foreground",
          className,
        )}
        title={t("previewUnavailable")}
      >
        <Stamp className="h-4 w-4 opacity-50" />
        <span className="text-[10px] leading-none">{t("previewUnavailable")}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-14 w-20 items-center justify-center rounded border bg-white p-1",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/files/${storageKey}`}
        alt={alt}
        className="max-h-12 max-w-full object-contain"
        onError={() => setBroken(true)}
        onLoad={(e) => {
          const img = e.currentTarget;
          // E2E / stub uploads used a 1×1 transparent PNG — treat as empty.
          if (img.naturalWidth < 16 || img.naturalHeight < 16) {
            setBroken(true);
          }
        }}
      />
    </div>
  );
}
