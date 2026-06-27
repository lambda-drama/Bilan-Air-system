"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { listPaymentBookings, type AirBookingRow } from "@/services/portal";
import { fetchBookingDetails, type BookingDetails } from "@/services/airBooking";
import { ConfirmPaymentDialog } from "@/components/portal/confirm-payment-dialog";
import { toast } from "sonner";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { DocLink } from "@/components/portal/doc-link";
import { ListPagination } from "@/components/portal/list-pagination";
import { PaginatedListContainer, PaginatedListPage } from "@/components/portal/paginated-list-container";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { ListSearch } from "@/components/portal/list-search";
import { usePaginatedListQuery } from "@/hooks/use-paginated-list-query";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export default function PortalPaymentsPage() {
  const { formatMoney } = useCurrency();
  const fetchPayments = useCallback(
    async (search: string, limit: number, offset: number) => {
      return listPaymentBookings({
        limit,
        offset,
        search: search.trim() || undefined,
      });
    },
    [],
  );
  const {
    search,
    setSearch,
    rows,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    loading,
    refresh,
  } = usePaginatedListQuery<AirBookingRow>(fetchPayments);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BookingDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentDialogPnr, setPaymentDialogPnr] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetchBookingDetails(selectedId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const selectedRow = rows.find((b) => b.name === selectedId);

  return (
    <PaginatedListPage>
      <div>
        <h2 className="text-2xl font-semibold">Payments</h2>
        <p className="text-sm text-muted-foreground">
          Confirm payments for bookings — see{" "}
          <Link href="/portal/invoices" className="font-medium text-gold hover:underline">
            Invoices
          </Link>{" "}
          for sales invoices.
        </p>
      </div>

      <ListSearch
        value={search}
        onChange={setSearch}
        placeholder="Search PNR, payer..."
      />

      {loading ? (
        <p>Loading...</p>
      ) : (
        <PaginatedListContainer
          pagination={
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PNR</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {search.trim() ? "No payments match your search." : "No payment records yet."}
                  </TableCell>
                </TableRow>
              ) : (
              rows.map((b) => (
                <TableRow
                  key={b.name}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(b.name)}
                >
                  <TableCell>
                    <DocLink onClick={() => setSelectedId(b.name)}>{b.name}</DocLink>
                  </TableCell>
                  <TableCell>{b.payer_name}</TableCell>
                  <TableCell>{b.payment_status}</TableCell>
                  <TableCell>{formatMoney(b.total_fare)}</TableCell>
                  <TableCell>{b.sales_invoice || "—"}</TableCell>
                  <TableCell className="text-right">
                    <ListRowActions doctype="Air Booking" docName={b.name}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {b.payment_status === "Pending" && (
                            <DropdownMenuItem onClick={() => setPaymentDialogPnr(b.name)}>
                              Confirm payment
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ListRowActions>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </PaginatedListContainer>
      )}

      <DetailSheet
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selectedId || ""}
        subtitle={selectedRow?.payer_name}
        badge={
          selectedRow
            ? { label: selectedRow.payment_status, variant: "outline" }
            : undefined
        }
        isLoading={detailLoading}
        footer={
          selectedRow?.payment_status === "Pending" ? (
            <Button
              className="bg-gold text-navy hover:bg-gold-dark"
              onClick={() => selectedId && setPaymentDialogPnr(selectedId)}
            >
              Confirm payment
            </Button>
          ) : undefined
        }
      >
        {detail ? (
          <DetailSection title="Payment">
            <DetailRow label="Payment status" value={detail.payment_status} />
            <DetailRow label="Total" value={formatMoney(detail.total_fare)} />
            <DetailRow label="Booking status" value={detail.status} />
          </DetailSection>
        ) : (
          selectedRow && (
            <DetailSection title="Payment">
              <DetailRow label="Payment status" value={selectedRow.payment_status} />
              <DetailRow label="Total" value={formatMoney(selectedRow.total_fare)} />
              <DetailRow label="Sales invoice" value={selectedRow.sales_invoice} />
            </DetailSection>
          )
        )}
      </DetailSheet>

      <ConfirmPaymentDialog
        open={!!paymentDialogPnr}
        pnr={paymentDialogPnr}
        onOpenChange={(open) => !open && setPaymentDialogPnr(null)}
        onSuccess={(pnr) => {
          toast.success("Payment confirmed");
          refresh();
          if (selectedId === pnr) fetchBookingDetails(pnr).then(setDetail);
        }}
      />
    </PaginatedListPage>
  );
}
