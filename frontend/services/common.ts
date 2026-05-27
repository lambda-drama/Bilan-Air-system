import { apiRequest, methodUrl } from "./apiClient";

export async function fetchPrintFormats(doctype: string): Promise<string[]> {
  if (!doctype) return ["Standard"];
  const formats = await apiRequest<string[]>(methodUrl("portal", "get_print_formats"), {
    method: "POST",
    body: JSON.stringify({ doctype }),
  });
  return Array.isArray(formats) && formats.length ? formats : ["Standard"];
}

export function openDocumentPrintView(
  doctype: string,
  docName: string,
  format = "Standard",
  options?: { noLetterhead?: number; triggerPrint?: number },
) {
  const params = new URLSearchParams();
  params.set("doctype", doctype);
  params.set("name", docName);
  params.set("format", format);
  params.set("trigger_print", String(options?.triggerPrint ?? 1));
  params.set("no_letterhead", String(options?.noLetterhead ?? 0));
  const base = typeof window !== "undefined" ? window.location.origin : "";
  window.open(`${base}/printview?${params.toString()}`, "_blank", "noopener,noreferrer");
}
