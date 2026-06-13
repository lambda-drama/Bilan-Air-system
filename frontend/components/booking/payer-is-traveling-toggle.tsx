"use client";

import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PayerIsTravelingToggle({
  active,
  onToggle,
  className,
  label = "Payer is also traveling",
}: {
  active: boolean;
  onToggle: (active: boolean) => void;
  className?: string;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "h-8 gap-1.5 text-xs font-normal",
        active
          ? "border-gold/40 bg-gold/15 text-foreground hover:bg-gold/25 dark:border-transparent dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80"
          : "text-muted-foreground",
        className,
      )}
      onClick={() => onToggle(!active)}
    >
      <UserCheck className="h-3.5 w-3.5" />
      {active ? `${label} — using payer details` : label}
    </Button>
  );
}
