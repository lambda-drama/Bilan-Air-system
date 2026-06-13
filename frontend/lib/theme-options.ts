import { Monitor, Moon, Sun } from "lucide-react";

export const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export type ThemeValue = (typeof THEMES)[number]["value"];

export function nextTheme(current: string): ThemeValue {
  const values = THEMES.map((t) => t.value);
  const idx = values.indexOf(current as ThemeValue);
  const nextIdx = idx === -1 ? 0 : (idx + 1) % values.length;
  return values[nextIdx];
}

export function themeOption(value: string) {
  return THEMES.find((t) => t.value === value) ?? THEMES[2];
}
