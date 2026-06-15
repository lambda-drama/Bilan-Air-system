"use client";

import { Loader2 } from "lucide-react";
import { useFlightPlanGeneration } from "@/contexts/flight-plan-generation-context";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function PortalGenerationBanner() {
  const { activeGenerations } = useFlightPlanGeneration();
  if (activeGenerations.length === 0) return null;

  const primary = activeGenerations[0];
  const extraCount = activeGenerations.length - 1;
  const hasTotal = primary.expectedCount > 0;
  const progressValue = hasTotal
    ? Math.min(
        100,
        Math.round((primary.processedCount / primary.expectedCount) * 100),
      )
    : undefined;

  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-gold/35 bg-gold/8 px-2.5 py-2 lg:max-w-md",
        "animate-in fade-in slide-in-from-top-1 duration-300",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mb-1.5 flex min-w-0 items-center gap-2 text-xs">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gold" />
        <span className="min-w-0 truncate text-muted-foreground">
          Generating in the background:{" "}
          <span className="font-medium text-foreground">{primary.planTitle}</span>
          {hasTotal ? (
            <span className="text-muted-foreground">
              {" "}
              ({primary.processedCount}/{primary.expectedCount})
            </span>
          ) : null}
          {extraCount > 0 ? (
            <span className="text-muted-foreground"> +{extraCount} more</span>
          ) : null}
        </span>
      </div>
      <Progress
        value={progressValue}
        className={cn(
          "h-1.5 bg-gold/20 [&>[data-slot=progress-indicator]]:bg-gold",
          progressValue == null && "bilan-generation-progress-indeterminate",
        )}
      />
    </div>
  );
}
