export interface CurrencyDisplay {
  currency: string;
  symbol: string;
}

export function formatAmount(
  amount: number | string | null | undefined,
  currencyCode: string,
  locale = "en",
): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}

export function formatAmountWithSymbol(
  amount: number | string | null | undefined,
  symbol: string,
): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const formatted = value.toLocaleString("en", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}
