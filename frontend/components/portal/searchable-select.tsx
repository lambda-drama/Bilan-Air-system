"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  onSearchChange?: (search: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  valueLabel?: string;
  clearable?: boolean;
  /** Called when Enter is pressed with typed text and no dropdown row is highlighted. */
  onSubmitRaw?: (value: string) => void;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  onSearchChange,
  placeholder = "Search...",
  emptyMessage = "No results found",
  isLoading = false,
  disabled = false,
  className,
  inputClassName,
  valueLabel,
  clearable = true,
  onSubmitRaw,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const closedDisplayLabel =
    selectedOption?.label || (value && valueLabel ? valueLabel : "");

  const filtered = search
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.value.toLowerCase().includes(search.toLowerCase()) ||
          (o.description?.toLowerCase().includes(search.toLowerCase()) ?? false),
      )
    : options;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [search, open]);

  const handleSearchChange = useCallback(
    (val: string) => {
      setSearch(val);
      onSearchChange?.(val);
    },
    [onSearchChange],
  );

  const selectOption = useCallback(
    (opt: SearchableSelectOption) => {
      onValueChange(opt.value);
      setSearch("");
      setOpen(false);
    },
    [onValueChange],
  );

  const clear = useCallback(() => {
    onValueChange("");
    setSearch("");
    handleSearchChange("");
  }, [onValueChange, handleSearchChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0) {
        selectOption(filtered[highlightedIndex]);
        return;
      }
      const typed = search.trim();
      if (!typed) return;
      const exact = options.find((o) => o.value.toLowerCase() === typed.toLowerCase());
      if (exact) {
        selectOption(exact);
      } else {
        onSubmitRaw?.(typed);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const inputPadRight = value && clearable ? "pr-16" : "pr-10";

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder={closedDisplayLabel || placeholder}
          value={open ? search : closedDisplayLabel}
          onChange={(e) => {
            handleSearchChange(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (selectedOption) setSearch("");
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            "h-9",
            inputPadRight,
            !open && selectedOption && "text-foreground",
            open && "ring-1 ring-gold border-gold",
            inputClassName,
          )}
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {value && clearable && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              tabIndex={-1}
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(!open);
              if (!open) inputRef.current?.focus();
            }}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            tabIndex={-1}
            disabled={disabled}
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          <div ref={listRef} className="max-h-60 overflow-auto p-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">{emptyMessage}</div>
            ) : (
              filtered.map((option, idx) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectOption(option)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                    "hover:bg-muted",
                    highlightedIndex === idx && "bg-muted",
                    value === option.value && "font-medium text-gold",
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      value === option.value ? "text-gold opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex min-w-0 flex-col items-start text-left">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
