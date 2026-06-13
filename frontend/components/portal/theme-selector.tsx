"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { nextTheme, themeOption, type ThemeValue } from "@/lib/theme-options";

/** Settings-page theme control — click cycles light → dark → system. */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = (mounted ? theme || "system" : "system") as ThemeValue;
  const { label, icon: Icon } = themeOption(current);

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full max-w-xs justify-start gap-2"
      disabled={!mounted}
      onClick={() => setTheme(nextTheme(current))}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}
