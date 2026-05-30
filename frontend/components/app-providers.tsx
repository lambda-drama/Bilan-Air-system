"use client";

import { CurrencyProvider } from "@/contexts/currency-context";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { LocaleProvider } from "@/contexts/locale-context";
import { NavigationProgress } from "@/components/motion/navigation-progress";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="bilan-theme">
      <LocaleProvider>
        <AuthProvider>
          <CurrencyProvider>
            <NavigationProgress />
            {children}
            <Toaster richColors position="top-center" />
          </CurrencyProvider>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
