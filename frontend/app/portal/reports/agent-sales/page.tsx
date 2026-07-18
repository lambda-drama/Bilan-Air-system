"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrency } from "@/contexts/currency-context";
import { PortalReportPdfPreviewDialog } from "@/components/portal/portal-report-pdf-preview";
import {
  exportPortalReportExcel,
  fetchPortalReportPdf,
  type PortalReportPdfColumn,
  type PortalReportPdfFile,
} from "@/lib/portal-report-export";
import {
  getAgentSalesReport,
  type AgentSalesReportData,
  type AgentSalesRow,
} from "@/services/portal";
import { toast } from "sonner";

const ALL_AGENTS = "__all__";

const PDF_COLUMNS: PortalReportPdfColumn[] = [
  { key: "agent_name", label: "Agent" },
  { key: "bookings", label: "Bookings" },
  { key: "confirmed", label: "Confirmed" },
  { key: "booked", label: "Booked" },
  { key: "paid", label: "Paid" },
  { key: "on_credit", label: "On credit" },
  { key: "passengers", label: "Passengers" },
  { key: "revenue", label: "Revenue" },
  { key: "paid_revenue", label: "Paid revenue" },
  { key: "outstanding", label: "Outstanding" },
];

function defaultFromDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultToDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatCount(value: number) {
  return value.toLocaleString();
}

export default function AgentSalesReportPage() {
  const { formatMoney } = useCurrency();
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [agentFilter, setAgentFilter] = useState(ALL_AGENTS);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<PortalReportPdfFile | null>(null);
  const [report, setReport] = useState<AgentSalesReportData | null>(null);

  const load = async (opts?: { from_date?: string; to_date?: string; booking_agent?: string }) => {
    setLoading(true);
    try {
      const data = await getAgentSalesReport({
        from_date: opts?.from_date ?? fromDate,
        to_date: opts?.to_date ?? toDate,
        booking_agent:
          opts?.booking_agent === ALL_AGENTS
            ? undefined
            : opts?.booking_agent ?? (agentFilter === ALL_AGENTS ? undefined : agentFilter),
      });
      setReport(data);
      if (data.scoped_to_agent) {
        setAgentFilter(data.scoped_to_agent);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load agent sales");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agentOptions = useMemo(() => {
    const options = (report?.agent_options || []).map((a) => ({
      value: a.value,
      label: a.label,
    }));
    if (!report?.scoped_to_agent) {
      return [{ value: ALL_AGENTS, label: "All agents" }, ...options];
    }
    return options;
  }, [report?.agent_options, report?.scoped_to_agent]);

  const handleSearch = () => {
    if (!fromDate || !toDate) {
      toast.error("Select from and to dates");
      return;
    }
    void load({
      from_date: fromDate,
      to_date: toDate,
      booking_agent: agentFilter,
    });
  };

  const buildExportRows = () => {
    if (!report) return [];
    const rows = report.agents.map((row: AgentSalesRow) => ({
      agent_name: row.agent_name,
      bookings: String(row.bookings),
      confirmed: String(row.confirmed),
      booked: String(row.booked),
      paid: String(row.paid),
      on_credit: String(row.on_credit),
      passengers: String(row.passengers),
      revenue: formatMoney(row.revenue),
      paid_revenue: formatMoney(row.paid_revenue),
      outstanding: formatMoney(row.outstanding),
    }));
    rows.push({
      agent_name: "Total",
      bookings: String(report.totals.bookings),
      confirmed: String(report.totals.confirmed),
      booked: String(report.totals.booked),
      paid: String(report.totals.paid),
      on_credit: String(report.totals.on_credit),
      passengers: String(report.totals.passengers),
      revenue: formatMoney(report.totals.revenue),
      paid_revenue: formatMoney(report.totals.paid_revenue),
      outstanding: formatMoney(report.totals.outstanding),
    });
    return rows;
  };

  const handleExportPdf = async () => {
    if (!report?.agents.length) {
      toast.error("Nothing to export");
      return;
    }
    setExportingPdf(true);
    try {
      const file = await fetchPortalReportPdf({
        title: "Agent sales report",
        subtitle: `${report.from_date} → ${report.to_date}`,
        filename: `agent-sales-${report.from_date}-to-${report.to_date}.pdf`,
        columns: PDF_COLUMNS,
        rows: buildExportRows(),
        reportKey: "agent_sales",
      });
      setPdfFile(file);
      setPdfPreviewOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    if (!report?.agents.length) {
      toast.error("Nothing to export");
      return;
    }
    setExportingExcel(true);
    try {
      exportPortalReportExcel({
        filename: `agent-sales-${report.from_date}-to-${report.to_date}`,
        columns: PDF_COLUMNS,
        rows: buildExportRows(),
      });
      toast.success("Excel file downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Excel export failed");
    } finally {
      setExportingExcel(false);
    }
  };

  const totals = report?.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold">Agent sales</h2>
          <p className="text-sm text-muted-foreground">
            Bookings and revenue by booking agent for the selected period
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-gold hover:border-gold hover:bg-gold hover:text-navy"
            disabled={exportingExcel || loading || !report?.agents.length}
            onClick={handleExportExcel}
          >
            {exportingExcel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Excel
          </Button>
          <Button
            variant="outline"
            className="border-gold hover:border-gold hover:bg-gold hover:text-navy"
            disabled={exportingPdf || loading || !report?.agents.length}
            onClick={() => void handleExportPdf()}
          >
            {exportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="agent-sales-from">From date</Label>
          <Input
            id="agent-sales-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-sales-to">To date</Label>
          <Input
            id="agent-sales-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Agent</Label>
          <SearchableSelect
            options={agentOptions}
            value={agentFilter}
            onValueChange={setAgentFilter}
            placeholder="All agents"
            clearable={false}
            disabled={!!report?.scoped_to_agent}
          />
        </div>
        <div className="flex items-end">
          <Button
            className="w-full bg-gold text-navy hover:bg-gold-dark"
            disabled={loading}
            onClick={handleSearch}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Run report
          </Button>
        </div>
      </div>

      {totals ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(totals.revenue)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paid revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(totals.paid_revenue)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(totals.outstanding)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bookings</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatCount(totals.bookings)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Passengers</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatCount(totals.passengers)}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="rounded-lg border bg-card">
        {loading ? (
          <p className="flex items-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading agent sales…
          </p>
        ) : !report?.agents.length ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <Users className="h-8 w-8 opacity-50" />
            <p>No agent sales in this period.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Confirmed</TableHead>
                <TableHead className="text-right">Booked</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">On credit</TableHead>
                <TableHead className="text-right">Passengers</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Paid revenue</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.agents.map((row) => (
                <TableRow key={row.booking_agent || "unassigned"}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{row.agent_name}</p>
                      {row.agent_email ? (
                        <p className="text-xs text-muted-foreground">{row.agent_email}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCount(row.bookings)}</TableCell>
                  <TableCell className="text-right">{formatCount(row.confirmed)}</TableCell>
                  <TableCell className="text-right">{formatCount(row.booked)}</TableCell>
                  <TableCell className="text-right">{formatCount(row.paid)}</TableCell>
                  <TableCell className="text-right">{formatCount(row.on_credit)}</TableCell>
                  <TableCell className="text-right">{formatCount(row.passengers)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(row.revenue)}
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(row.paid_revenue)}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.outstanding)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatCount(report.totals.bookings)}</TableCell>
                <TableCell className="text-right">{formatCount(report.totals.confirmed)}</TableCell>
                <TableCell className="text-right">{formatCount(report.totals.booked)}</TableCell>
                <TableCell className="text-right">{formatCount(report.totals.paid)}</TableCell>
                <TableCell className="text-right">{formatCount(report.totals.on_credit)}</TableCell>
                <TableCell className="text-right">{formatCount(report.totals.passengers)}</TableCell>
                <TableCell className="text-right">{formatMoney(report.totals.revenue)}</TableCell>
                <TableCell className="text-right">
                  {formatMoney(report.totals.paid_revenue)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(report.totals.outstanding)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>

      <PortalReportPdfPreviewDialog
        open={pdfPreviewOpen}
        onOpenChange={(open) => {
          setPdfPreviewOpen(open);
          if (!open) setPdfFile(null);
        }}
        title="Agent sales report"
        file={pdfFile}
      />
    </div>
  );
}
