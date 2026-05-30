"use client";

import { Globe } from "lucide-react";
import { useLocale } from "@/contexts/locale-context";
import { LOCALES } from "@/lib/i18n/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LanguageSwitcherProps = {
  variant?: "footer" | "default";
};

export function LanguageSwitcher({ variant = "default" }: LanguageSwitcherProps) {
  const { locale, setLocale, messages } = useLocale();

  const isFooter = variant === "footer";

  return (
    <div className="flex items-center gap-2">
      <Globe
        className={isFooter ? "h-4 w-4 text-cream/50 shrink-0" : "h-4 w-4 text-muted-foreground shrink-0"}
        aria-hidden
      />
      <Select value={locale} onValueChange={(value) => setLocale(value as typeof locale)}>
        <SelectTrigger
          aria-label={messages.footer.language}
          className={
            isFooter
              ? "h-9 min-w-[9.5rem] border-cream/20 bg-navy-light/40 text-cream text-sm focus:ring-gold/40"
              : "h-9 min-w-[9.5rem]"
          }
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align={isFooter ? "end" : "start"}>
          {LOCALES.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.nativeLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
