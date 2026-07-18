import { apiRequest, methodUrl } from "@/services/apiClient";
import type { AgentReportKey } from "@/lib/portal-permissions";

export type PortalReportPdfColumn = {
  key: string;
  label: string;
};

export type PortalReportPdfFile = {
  filename: string;
  content: string;
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

/** Fetch report PDF for preview; caller downloads after preview if desired. */
export async function fetchPortalReportPdf(opts: {
  title: string;
  subtitle?: string;
  filename: string;
  columns: PortalReportPdfColumn[];
  rows: Record<string, string>[];
  reportKey?: AgentReportKey;
}): Promise<PortalReportPdfFile> {
  return apiRequest<PortalReportPdfFile>(
    methodUrl("portal", "export_portal_report_pdf"),
    {
      method: "POST",
      body: JSON.stringify({
        title: opts.title,
        subtitle: opts.subtitle ?? null,
        filename: opts.filename,
        columns: opts.columns,
        rows: opts.rows,
        report_key: opts.reportKey ?? null,
      }),
    },
  );
}

function escapeCsvCell(value: string) {
  const text = value ?? "";
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Excel-friendly CSV (UTF-8 BOM). Opens cleanly in Excel / Google Sheets. */
export function exportPortalReportExcel(opts: {
  filename: string;
  columns: PortalReportPdfColumn[];
  rows: Record<string, string>[];
}) {
  const header = opts.columns.map((col) => escapeCsvCell(col.label)).join(",");
  const lines = opts.rows.map((row) =>
    opts.columns.map((col) => escapeCsvCell(row[col.key] ?? "")).join(","),
  );
  const csv = `\uFEFF${[header, ...lines].join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const base = opts.filename.replace(/\.xlsx$/i, "").replace(/\.csv$/i, "");
  anchor.href = url;
  anchor.download = `${base}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
