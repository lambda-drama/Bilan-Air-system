"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = theme || "system";
  const CurrentIcon = THEMES.find((t) => t.value === current)?.icon ?? Monitor;

  return (
    <Select
      value={mounted ? current : "system"}
      onValueChange={(v) => setTheme(v)}
      disabled={!mounted}
    >
      <SelectTrigger className="w-full max-w-xs">
        <SelectValue placeholder="Theme">
          <span className="flex items-center gap-2">
            <CurrentIcon className="h-4 w-4" />
            {THEMES.find((t) => t.value === current)?.label ?? "System"}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {THEMES.map(({ value, label, icon: Icon }) => (
          <SelectItem key={value} value={value}>
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
