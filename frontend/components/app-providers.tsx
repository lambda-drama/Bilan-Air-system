"use client";

import { CurrencyProvider } from "@/contexts/currency-context";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="bilan-theme">
      <CurrencyProvider>
        {children}
        <Toaster richColors position="top-center" />
      </CurrencyProvider>
    </ThemeProvider>
  );
}
