"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { fetchPrintFormats, openDocumentPrintView } from "@/services/common";
import { Button } from "@/components/ui/button";

interface PrintFormatDropdownProps {
  doctype: string;
  docName: string;
  className?: string;
  variant?: "default" | "icon";
}

export function PrintFormatDropdown({
  doctype,
  docName,
  className,
  variant = "icon",
}: PrintFormatDropdownProps) {
  const [open, setOpen] = useState(false);
  const [formats, setFormats] = useState<string[]>(["Standard"]);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !doctype) return;
    setLoading(true);
    fetchPrintFormats(doctype)
      .then(setFormats)
      .catch(() => setFormats(["Standard"]))
      .finally(() => setLoading(false));
  }, [open, doctype]);

  const updatePosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      right: typeof window !== "undefined" ? window.innerWidth - rect.right : 0,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!containerRef.current?.contains(target) && !target.closest("[data-print-format-menu]")) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const menuEl =
    open && position && typeof document !== "undefined" ? (
      <div
        data-print-format-menu
        className="fixed z-[9999] min-w-[180px] rounded-md border bg-popover py-1 shadow-lg"
        style={{ top: position.top, right: position.right, left: "auto" }}
      >
        <div className="border-b px-3 py-1.5 text-xs font-medium text-muted-foreground">
          Print format
        </div>
        {loading ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
        ) : (
          formats.map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => {
                openDocumentPrintView(doctype, docName, format);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
            >
              {format}
            </button>
          ))
        )}
      </div>
    ) : null;

  const isIcon = variant === "icon";

  return (
    <div className="relative inline-block" ref={containerRef} onClick={(e) => e.stopPropagation()}>
      <Button
        ref={buttonRef}
        type="button"
        variant={isIcon ? "ghost" : "outline"}
        size={isIcon ? "icon" : "sm"}
        onClick={() => setOpen((p) => !p)}
        className={className}
        aria-label="Print"
        title="Print"
      >
        <Printer className={isIcon ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        {!isIcon && "Print"}
      </Button>
      {typeof document !== "undefined" && menuEl && createPortal(menuEl, document.body)}
    </div>
  );
}
