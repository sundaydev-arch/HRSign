"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText, ImageIcon, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropzone({
  accept,
  file,
  onFileChange,
  idleTitle,
  idleHint,
  activeTitle,
  replaceLabel,
  clearLabel,
  previewAlt,
  kind = "file",
  className,
}: {
  accept: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  idleTitle: string;
  idleHint?: string;
  activeTitle: string;
  replaceLabel: string;
  clearLabel: string;
  previewAlt?: string;
  kind?: "image" | "file";
  className?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || kind !== "image") {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, kind]);

  function pick(list: FileList | null) {
    const next = list?.[0] ?? null;
    onFileChange(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => pick(e.target.files)}
      />

      {!file ? (
        <label
          htmlFor={inputId}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files);
          }}
          className={cn(
            "group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center transition-[border-color,background-color,box-shadow]",
            dragging
              ? "border-foreground/40 bg-muted/70 shadow-sm"
              : "border-border bg-muted/30 hover:border-foreground/25 hover:bg-muted/50",
          )}
        >
          <span
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors",
              dragging && "border-foreground/20 text-foreground",
            )}
          >
            <Upload className="h-5 w-5" />
          </span>
          <span className="space-y-1">
            <span className="block text-sm font-medium tracking-tight text-foreground">
              {dragging ? activeTitle : idleTitle}
            </span>
            {idleHint ? (
              <span className="block text-xs text-muted-foreground">{idleHint}</span>
            ) : null}
          </span>
        </label>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {kind === "image" && previewUrl ? (
            <div
              className="flex items-center justify-center px-4 py-6"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%), linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)",
                backgroundSize: "12px 12px",
                backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={previewAlt ?? file.name}
                className="max-h-32 max-w-full object-contain drop-shadow-sm"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-muted-foreground">
                {kind === "image" ? (
                  <ImageIcon className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border/80 bg-muted/20 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{file.name}</div>
              <div className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => inputRef.current?.click()}
              >
                {replaceLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={clearLabel}
                onClick={() => onFileChange(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
