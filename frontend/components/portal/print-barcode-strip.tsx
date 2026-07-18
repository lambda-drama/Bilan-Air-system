"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type PrintBarcodeFormat = "pdf417" | "code128";

type Props = {
  value: string;
  format?: PrintBarcodeFormat;
  className?: string;
};

/** Renders a scannable barcode (PDF417 for IATA BCBP tickets / boarding passes). */
export function PrintBarcodeStrip({ value, format = "pdf417", className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    const render = async () => {
      if (!value || !canvasRef.current) return;
      try {
        const bwipjs = await import("bwip-js");
        if (cancelled || !canvasRef.current) return;

        const isPdf417 = format === "pdf417";
        bwipjs.toCanvas(canvasRef.current, {
          bcid: isPdf417 ? "pdf417" : "code128",
          text: value,
          scale: isPdf417 ? 2 : 2,
          height: isPdf417 ? 12 : 14,
          includetext: false,
          paddingwidth: 2,
          paddingheight: 2,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [value, format]);

  if (!value) return null;

  if (failed) {
    return (
      <p className="max-w-[11rem] break-all font-mono text-[8px] leading-tight text-navy/70">
        {value}
      </p>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Barcode"
      className={cn("max-h-16 w-auto max-w-[11rem] bg-white", className)}
    />
  );
}
