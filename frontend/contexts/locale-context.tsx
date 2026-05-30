"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getMessages, isRtlLocale } from "@/lib/i18n";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  type Locale,
  type Messages,
} from "@/lib/i18n/types";

type LocaleContextValue = {
  locale: Locale;
  messages: Messages;
  isRtl: boolean;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "ar" ? "ar" : DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale());
    setReady(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  const isRtl = isRtlLocale(locale);
  const messages = useMemo(() => getMessages(locale), [locale]);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.lang = locale;
    root.dir = isRtl ? "rtl" : "ltr";
  }, [locale, isRtl, ready]);

  const value = useMemo(
    () => ({ locale, messages, isRtl, setLocale }),
    [locale, messages, isRtl, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useTranslations() {
  return useLocale().messages;
}
