"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  badge?: { label: string; variant?: "default" | "secondary" | "destructive" | "outline" };
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-[100vw] flex-col overflow-hidden border-l-2 border-l-gold p-0 sm:max-w-xl md:max-w-2xl"
      >
        <SheetHeader className="bilan-panel-header space-y-0 text-left">
          <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-lg">{title}</SheetTitle>
                {badge && (
                  <Badge variant={badge.variant || "secondary"} className="bg-gold text-navy border-gold">
                    {badge.label}
                  </Badge>
                )}
              </div>
              {subtitle && <SheetDescription className="mt-1">{subtitle}</SheetDescription>}
            </div>
          </div>
        </SheetHeader>
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
      </SheetContent>
    </Sheet>
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
