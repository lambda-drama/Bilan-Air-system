import { ar } from "./messages/ar";
import { en } from "./messages/en";
import type { Locale, Messages } from "./types";

const catalogs: Record<Locale, Messages> = {
  en,
  ar,
};

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] ?? en;
}

export function isRtlLocale(locale: Locale): boolean {
  return locale === "ar";
}
