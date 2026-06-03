"use client";

import { Plane } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type PortalLoadingScreenProps = {
  message?: string;
  className?: string;
};

export function PortalLoadingScreen({
  message = "Loading portal",
  className,
}: PortalLoadingScreenProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col items-center justify-center bg-muted/30 px-6",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full border-2 border-gold/20"
          aria-hidden
        />
        <span
          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold border-r-gold/60"
          aria-hidden
        />
        <Plane className="relative h-9 w-9 text-gold" aria-hidden />
      </div>

      <p className="mt-8 text-sm font-medium text-foreground">{message}</p>
      <div className="mt-3 flex items-center gap-2 text-muted-foreground">
        <Spinner className="size-4 text-gold" />
        <span className="text-xs tracking-wide">Please wait</span>
      </div>
    </div>
  );
}
