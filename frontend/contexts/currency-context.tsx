"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { formatAmount } from "@/lib/format-currency";
import { fetchDisplayCurrency } from "@/services/currency";

interface CurrencyContextValue {
  currency: string;
  symbol: string;
  loading: boolean;
  formatMoney: (amount: number | string | null | undefined, docCurrency?: string) => string;
}

const defaultValue: CurrencyContextValue = {
  currency: "USD",
  symbol: "$",
  loading: true,
  formatMoney: (amount) => formatAmount(amount, "USD"),
};

const CurrencyContext = createContext<CurrencyContextValue>(defaultValue);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState("USD");
  const [symbol, setSymbol] = useState("$");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDisplayCurrency()
      .then((res) => {
        setCurrency(res.currency || "USD");
        setSymbol(res.symbol || res.currency || "$");
      })
      .catch(() => {
        setCurrency("USD");
        setSymbol("$");
      })
      .finally(() => setLoading(false));
  }, []);

  const formatMoney = useCallback(
    (amount: number | string | null | undefined, docCurrency?: string) => {
      const code = docCurrency || currency;
      return formatAmount(amount, code);
    },
    [currency],
  );

  const value = useMemo(
    () => ({ currency, symbol, loading, formatMoney }),
    [currency, symbol, loading, formatMoney],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
