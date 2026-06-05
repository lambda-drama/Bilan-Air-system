"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Wraps a disabled control so a tooltip still shows on hover (native disabled buttons block pointer events). */
export function DisabledActionTooltip({
  disabled,
  reason,
  children,
  side = "top",
}: {
  disabled: boolean;
  reason?: string | null;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  if (!disabled || !reason) {
    return <>{children}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex w-full min-w-0 cursor-not-allowed">{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-center">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}
