"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getAgentDisplayName } from "@/lib/agent-display";
import { cn } from "@/lib/utils";

type AgentNameCellProps = {
  name?: string | null;
  firstName?: string | null;
  className?: string;
  emptyLabel?: string;
};

export function AgentNameCell({
  name,
  firstName,
  className,
  emptyLabel = "—",
}: AgentNameCellProps) {
  const { full, first } = getAgentDisplayName(name, firstName);

  if (!full) {
    return <span className={className}>{emptyLabel}</span>;
  }

  if (!first || first === full) {
    return <span className={className}>{full}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("cursor-default truncate", className)}>{first}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{full}</TooltipContent>
    </Tooltip>
  );
}
