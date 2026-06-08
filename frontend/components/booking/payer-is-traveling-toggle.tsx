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
      variant={active ? "secondary" : "outline"}
      size="sm"
      className={cn("h-8 gap-1.5 text-xs font-normal", className)}
      onClick={() => onToggle(!active)}
    >
      <UserCheck className="h-3.5 w-3.5" />
      {active ? `${label} — using payer details` : label}
    </Button>
  );
}
