import { downloadBase64Pdf } from "@/lib/download-base64-pdf";
import { apiRequest, methodUrl } from "@/services/apiClient";

export type PortalReportPdfColumn = {
  key: string;
  label: string;
};

export type PortalReportFilters = {
  flight_number: string;
  departure_date: string;
  departure_time?: string;
  destination?: string;
};

export function buildReportSubtitle(filters: PortalReportFilters, extra?: string) {
  const parts = [
    `Flight ${filters.flight_number}`,
    filters.departure_date,
    filters.departure_time ? `Departure ${filters.departure_time}` : null,
    filters.destination ? "Destination filter applied" : null,
    extra,
  ].filter(Boolean);
  return parts.join(" · ");
}

export async function exportPortalReportPdf(opts: {
  title: string;
  subtitle?: string;
  filename: string;
  columns: PortalReportPdfColumn[];
  rows: Record<string, string>[];
}) {
  const result = await apiRequest<{ filename: string; content: string }>(
    methodUrl("portal", "export_portal_report_pdf"),
    {
      method: "POST",
      body: JSON.stringify({
        title: opts.title,
        subtitle: opts.subtitle ?? null,
        filename: opts.filename,
        columns: opts.columns,
        rows: opts.rows,
      }),
    },
  );
  downloadBase64Pdf(result.filename, result.content);
}
