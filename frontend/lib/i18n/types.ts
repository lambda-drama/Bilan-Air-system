export type Locale = "en" | "ar";

export const LOCALES: { value: Locale; label: string; nativeLabel: string }[] = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "ar", label: "Arabic", nativeLabel: "العربية" },
];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "bilan-locale";

export type Messages = typeof import("./messages/en").en;
