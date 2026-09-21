"use client";

import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

/**
 * Handwritten signature pad: draws with Pointer Events and exports a
 * transparent-background PNG data URL.
 */
export function SignaturePad({
  onChange,
  width = 480,
  height = 200,
}: {
  onChange: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
}) {
  const t = useTranslations("signaturePad");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // High-DPI screen adaptation
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
  }, [width, height]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setIsEmpty(false);
    }
  }

  function endDraw() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && dirtyRef.current) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirtyRef.current = false;
    setIsEmpty(true);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white p-1">
        <canvas
          ref={canvasRef}
          style={{ width, height, touchAction: "none" }}
          className="cursor-crosshair rounded"
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={isEmpty}>
          <Eraser className="mr-1 h-4 w-4" />
          {t("clear")}
        </Button>
      </div>
    </div>
  );
}
