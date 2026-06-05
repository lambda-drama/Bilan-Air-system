"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Printer } from "lucide-react";
import { fetchPrintFormats, openDocumentPrintView } from "@/services/common";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>();

  useLayoutEffect(() => {
    const host = containerRef.current?.closest(
      "[data-slot='sheet-content'], [data-slot='dialog-content']",
    );
    setPortalContainer(host instanceof HTMLElement ? host : undefined);
  }, []);

  useEffect(() => {
    if (!open || !doctype) return;
    setLoading(true);
    fetchPrintFormats(doctype)
      .then(setFormats)
      .catch(() => setFormats(["Standard"]))
      .finally(() => setLoading(false));
  }, [open, doctype]);

  const selectFormat = (format: string) => {
    openDocumentPrintView(doctype, docName, format);
    setOpen(false);
  };

  const isIcon = variant === "icon";

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={isIcon ? "ghost" : "outline"}
            size={isIcon ? "icon" : "sm"}
            className={className}
            aria-label="Print"
            title="Print"
          >
            <Printer className={isIcon ? "h-4 w-4" : "mr-2 h-4 w-4"} />
            {!isIcon && "Print"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuPrimitive.Portal container={portalContainer}>
          <DropdownMenuPrimitive.Content
            align="end"
            side="top"
            sideOffset={4}
            className={cn(
              "bg-popover text-popover-foreground z-200 min-w-[180px] overflow-hidden rounded-md border p-1 shadow-md",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Print format
            </DropdownMenuLabel>
            {loading ? (
              <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
            ) : (
              formats.map((format) => (
                <DropdownMenuItem
                  key={format}
                  className="cursor-pointer"
                  onSelect={() => selectFormat(format)}
                >
                  {format}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenu>
    </div>
  );
}
