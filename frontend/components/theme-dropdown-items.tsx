'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

/** Theme options shown directly in profile / account dropdowns (no nested submenu). */
export function ThemeDropdownSubmenu() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = mounted ? theme || 'system' : 'system';

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs text-muted-foreground">Appearance</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={current}
        onValueChange={(value) => {
          setTheme(value);
        }}
      >
        {THEMES.map(({ value, label, icon: Icon }) => (
          <DropdownMenuRadioItem key={value} value={value} disabled={!mounted}>
            <Icon className="h-4 w-4" />
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}
