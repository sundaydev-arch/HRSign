"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * PDF preview component (pdf.js render, all pages stacked vertically).
 * pdfjs-dist must be dynamically imported at client runtime to avoid SSR errors.
 */
export default function PdfViewer({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const t = useTranslations("pdf");
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    setLoading(true);
    setError(null);
    container.replaceChildren();

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const pdf = await pdfjs.getDocument({ url }).promise;
        const containerWidth = container.clientWidth || 720;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const base = page.getViewport({ scale: 1 });
          const scale = containerWidth / base.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "mb-3 block w-full rounded shadow-sm";
          container.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("canvas context unavailable");
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError(t("loadError"));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, t]);

  return (
    <div className={className}>
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      )}
      {error && <div className="py-16 text-center text-sm text-red-500">{error}</div>}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
