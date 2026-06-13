'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { nextTheme, themeOption, type ThemeValue } from '@/lib/theme-options';

/** Single theme control in profile dropdown — click cycles light → dark → system. */
export function ThemeDropdownSubmenu() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = (mounted ? theme || 'system' : 'system') as ThemeValue;
  const { label, icon: Icon } = themeOption(current);

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        disabled={!mounted}
        onSelect={(event) => {
          event.preventDefault();
          setTheme(nextTheme(current));
        }}
      >
        <Icon className="h-4 w-4" />
        {label}
      </DropdownMenuItem>
    </>
  );
}
