"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clearPortalPointerLocks } from "@/lib/portal-pointer-lock";

interface DetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  badge?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  };
  isLoading?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function DetailSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  badge,
  isLoading,
  footer,
  children,
}: DetailSheetProps) {
  useEffect(() => {
    if (!open) {
      clearPortalPointerLocks();
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearPortalPointerLocks();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close details"
        className="fixed inset-0 z-40 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div
        data-slot="sheet-content"
        data-state="open"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[100vw] flex-col overflow-hidden border-l-2 border-l-gold bg-background shadow-xl sm:max-w-xl md:max-w-2xl"
      >
        <div className="bilan-panel-header relative space-y-0 text-left">
          <div className="flex flex-col gap-3 pr-12 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{title}</h2>
                {badge && (
                  <Badge
                    variant={badge.variant || "outline"}
                    className={badge.className || "bg-gold text-navy border-gold"}
                  >
                    {badge.label}
                  </Badge>
                )}
              </div>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 h-8 w-8"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Separator className="bg-secondary/15" />
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">{children}</div>
            {footer && <div className="bilan-panel-footer">{footer}</div>}
          </>
        )}
      </div>
    </>
  );
}

export function DetailSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-secondary">
        <span className="h-4 w-1 rounded-full bg-gold" />
        {title}
      </h3>
      <div className="space-y-3 rounded-lg border border-secondary/10 bg-card p-3">{children}</div>
    </div>
  );
}

export function DetailRow({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium sm:text-right", valueClassName)}>
        {value ?? "—"}
      </span>
    </div>
  );
}
