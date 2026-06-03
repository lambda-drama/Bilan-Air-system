"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  getBookingInvoiceDetail,
  listBookingInvoices,
  type BookingInvoiceDetail,
  type BookingInvoiceRow,
} from "@/services/portal";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { DocLink } from "@/components/portal/doc-link";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { ListSearch } from "@/components/portal/list-search";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { useCurrency } from "@/contexts/currency-context";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function docstatusLabel(docstatus?: number): string {
  if (docstatus === 1) return "Submitted";
  if (docstatus === 2) return "Cancelled";
  return "Draft";
}

export default function PortalInvoicesPage() {
  const { formatMoney } = useCurrency();
  const fetchInvoices = useCallback(async (search: string) => {
    const res = await listBookingInvoices({
      search: search.trim() || undefined,
      limit: 100,
    });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, error } = useLiveListQuery<BookingInvoiceRow>(
    fetchInvoices,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BookingInvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    getBookingInvoiceDetail(selectedId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const selectedRow = rows.find((r) => r.name === selectedId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Invoices</h2>
        <p className="text-sm text-muted-foreground">
          Sales invoices linked to air bookings
        </p>
      </div>

      <ListSearch
        value={search}
        onChange={setSearch}
        placeholder="Search invoice, PNR, payer, customer..."
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>PNR</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    {search.trim()
                      ? "No invoices match your search."
                      : "No invoices yet. Create one from a booking."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((inv) => (
                  <TableRow
                    key={`${inv.booking_pnr}-${inv.name}`}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(inv.name)}
                  >
                    <TableCell>
                      <DocLink onClick={() => setSelectedId(inv.name)}>{inv.name}</DocLink>
                    </TableCell>
                    <TableCell>{inv.booking_pnr}</TableCell>
                    <TableCell>{inv.payer_name || "—"}</TableCell>
                    <TableCell>{inv.invoice_type || "—"}</TableCell>
                    <TableCell>{inv.invoice_status || docstatusLabel(inv.docstatus)}</TableCell>
                    <TableCell>
                      {inv.grand_total != null
                        ? formatMoney(inv.grand_total, inv.currency)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {inv.outstanding_amount != null
                        ? formatMoney(inv.outstanding_amount, inv.currency)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <ListRowActions doctype="Sales Invoice" docName={inv.name}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href="/portal/bookings">View bookings</Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ListRowActions>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <DetailSheet
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selectedId || ""}
        subtitle={selectedRow?.booking_pnr ? `PNR ${selectedRow.booking_pnr}` : undefined}
        badge={
          selectedRow
            ? {
                label: selectedRow.invoice_status || docstatusLabel(selectedRow.docstatus),
                variant: "outline",
              }
            : undefined
        }
        isLoading={detailLoading}
      >
        {(detail || selectedRow) && (
          <>
            <DetailSection title="Invoice">
              <DetailRow label="Invoice" value={detail?.name || selectedRow?.name} />
              <DetailRow label="Type" value={detail?.invoice_type || selectedRow?.invoice_type} />
              <DetailRow
                label="Document status"
                value={docstatusLabel(detail?.docstatus ?? selectedRow?.docstatus)}
              />
              <DetailRow label="Invoice status" value={detail?.status || selectedRow?.invoice_status} />
              <DetailRow label="Customer" value={detail?.customer || selectedRow?.customer} />
              <DetailRow label="Posting date" value={detail?.posting_date || selectedRow?.posting_date} />
              <DetailRow label="Due date" value={detail?.due_date || selectedRow?.due_date} />
              <DetailRow
                label="Grand total"
                value={formatMoney(
                  detail?.grand_total ?? selectedRow?.grand_total,
                  detail?.currency || selectedRow?.currency,
                )}
              />
              <DetailRow
                label="Outstanding"
                value={formatMoney(
                  detail?.outstanding_amount ?? selectedRow?.outstanding_amount,
                  detail?.currency || selectedRow?.currency,
                )}
              />
            </DetailSection>
            <DetailSection title="Booking">
              <DetailRow
                label="PNR"
                value={detail?.booking_pnr || selectedRow?.booking_pnr}
              />
              <DetailRow
                label="Payer"
                value={detail?.booking?.payer_name || selectedRow?.payer_name}
              />
              <DetailRow
                label="Payment"
                value={detail?.booking?.payment_status || selectedRow?.payment_status}
              />
              <DetailRow
                label="Booking status"
                value={detail?.booking?.booking_status || selectedRow?.booking_status}
              />
              {detail?.booking?.payment_entry && (
                <DetailRow label="Payment entry" value={detail.booking.payment_entry} />
              )}
            </DetailSection>
            {detail?.remarks && (
              <DetailSection title="Remarks">
                <DetailRow label="Notes" value={detail.remarks} />
              </DetailSection>
            )}
          </>
        )}
      </DetailSheet>
    </div>
  );
}
