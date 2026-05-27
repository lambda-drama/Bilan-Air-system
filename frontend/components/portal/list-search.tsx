"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ListSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function ListSearch({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: ListSearchProps) {
  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
        aria-label={placeholder}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
