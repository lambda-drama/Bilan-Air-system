import { apiRequest, methodUrl } from "./apiClient";
import type { CurrencyDisplay } from "@/lib/format-currency";

export async function fetchDisplayCurrency(docCurrency?: string): Promise<CurrencyDisplay> {
  return apiRequest<CurrencyDisplay>(methodUrl("portal", "get_display_currency"), {
    method: "POST",
    body: JSON.stringify({ doc_currency: docCurrency ?? null }),
  });
}
