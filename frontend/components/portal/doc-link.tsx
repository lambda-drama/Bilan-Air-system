"use client";

import { cn } from "@/lib/utils";

export function DocLink({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "text-left font-medium text-foreground hover:underline",
        className,
      )}
    >
      {children}
    </button>
  );
}
