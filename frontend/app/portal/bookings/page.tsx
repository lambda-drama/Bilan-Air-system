"use client";

import { useCallback, useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { listBookings, type AirBookingRow } from "@/services/portal";
import {
  cancelBooking,
  confirmPaymentAndInvoice,
  fetchBookingDetails,
  type BookingDetails,
} from "@/services/airBooking";
import { openDeskDocument } from "@/services/desk";
import { toast } from "sonner";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { DocLink } from "@/components/portal/doc-link";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { ListSearch } from "@/components/portal/list-search";
import { PortalBookingSheetFooter } from "@/components/portal/portal-booking-actions";
import { useCurrency } from "@/contexts/currency-context";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { BookingStartLink } from "@/components/portal/booking-start-link";
import { BookingBaggagePanel } from "@/components/portal/booking-baggage-panel";
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

export default function PortalBookingsPage() {
  const { formatMoney } = useCurrency();
  const fetchBookings = useCallback(
    async (search: string) => {
      const res = await listBookings({ search: search.trim() || undefined, limit: 100 });
      return res.data;
    },
    [],
  );
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery<AirBookingRow>(
    fetchBookings,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [detail, setDetail] = useState<BookingDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [processingPnr, setProcessingPnr] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const reloadDetail = useCallback(async (pnr: string) => {
    const next = await fetchBookingDetails(pnr);
    setDetail(next);
    return next;
  }, []);

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

  const isUnpaid = (status: string) => status !== "Paid" && status !== "Refunded";

  const openDetails = (pnr: string, opts?: { cancel?: boolean }) => {
    setShowCancelForm(!!opts?.cancel);
    setSelectedId(pnr);
  };

  const closeDetails = () => {
    setSelectedId(null);
    setShowCancelForm(false);
  };

  const handleConfirmPaymentAndInvoice = async (pnr: string) => {
    setProcessingPnr(pnr);
    try {
      await confirmPaymentAndInvoice(pnr);
      toast.success("Payment confirmed and sales invoice created");
      refresh();
      if (selectedId === pnr) await reloadDetail(pnr);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to confirm payment");
    } finally {
      setProcessingPnr(null);
    }
  };

  const handleCancelBooking = async (reason: string) => {
    if (!selectedId) return;
    setCancelling(true);
    try {
      await cancelBooking(selectedId, reason);
      toast.success("Booking cancelled");
      refresh();
      await reloadDetail(selectedId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel booking");
      throw e;
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Bookings</h2>
          <p className="text-sm text-muted-foreground">
            In-office bookings — click PNR for details, edit, or cancel
          </p>
        </div>
        <BookingStartLink>Office booking</BookingStartLink>
      </div>

      <ListSearch
        value={search}
        onChange={setSearch}
        placeholder="Search PNR, name, phone..."
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PNR</TableHead>
                <TableHead>Flight</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {search.trim() ? "No bookings match your search." : "No bookings yet."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((b) => (
                  <TableRow
                    key={b.name}
                    className="cursor-pointer"
                    onClick={() => openDetails(b.name)}
                  >
                    <TableCell>
                      <DocLink onClick={() => openDetails(b.name)}>{b.name}</DocLink>
                    </TableCell>
                    <TableCell>{b.flight_schedule}</TableCell>
                    <TableCell>{b.payer_name}</TableCell>
                    <TableCell>{b.booking_status}</TableCell>
                    <TableCell>{b.payment_status}</TableCell>
                    <TableCell>{formatMoney(b.total_fare)}</TableCell>
                    <TableCell className="text-right">
                      <ListRowActions doctype="Air Booking" docName={b.name}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetails(b.name)}>
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeskDocument("Air Booking", b.name)}
                            >
                              Edit
                            </DropdownMenuItem>
                            {b.booking_status !== "Cancelled" && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => openDetails(b.name, { cancel: true })}
                              >
                                Cancel booking
                              </DropdownMenuItem>
                            )}
                            {isUnpaid(b.payment_status) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={processingPnr === b.name}
                                  onClick={() => handleConfirmPaymentAndInvoice(b.name)}
                                >
                                  Confirm payment & invoice
                                </DropdownMenuItem>
                              </>
                            )}
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
        onOpenChange={(open) => !open && closeDetails()}
        title={selectedId || ""}
        subtitle={selectedRow?.payer_name}
        badge={
          selectedRow
            ? { label: selectedRow.booking_status, variant: "outline" }
            : undefined
        }
        isLoading={detailLoading}
        footer={
          selectedId ? (
            <PortalBookingSheetFooter
              pnr={selectedId}
              detail={detail}
              row={selectedRow}
              showCancelForm={showCancelForm}
              onShowCancelForm={setShowCancelForm}
              onCancelComplete={() => refresh()}
              processingPayment={processingPnr === selectedId}
              cancelling={cancelling}
              onConfirmPayment={() => handleConfirmPaymentAndInvoice(selectedId)}
              onSubmitCancel={handleCancelBooking}
            />
          ) : undefined
        }
      >
        {detail && (
          <>
            <DetailSection title="Booking">
              <DetailRow label="PNR" value={detail.pnr} />
              <DetailRow label="Status" value={detail.status} />
              <DetailRow label="Payment" value={detail.payment_status} />
              <DetailRow label="Total fare" value={formatMoney(detail.total_fare)} />
              {detail.reason_for_cancel && (
                <DetailRow label="Cancel reason" value={detail.reason_for_cancel} />
              )}
            </DetailSection>
            <DetailSection title="Flight">
              <DetailRow label="Flight" value={detail.flight.flight_number} />
              <DetailRow
                label="Route"
                value={`${detail.flight.origin} → ${detail.flight.destination}`}
              />
              <DetailRow
                label="Departure"
                value={`${detail.flight.departure_date} ${detail.flight.departure_time}`}
              />
            </DetailSection>
            {detail.passengers?.length > 0 && (
              <DetailSection title="Passengers">
                {detail.passengers.map((p) => (
                  <DetailRow
                    key={p.name}
                    label={p.name}
                    value={`${p.type} · seat ${p.seat_label || p.seat}${p.ticket_number ? ` · ticket ${p.ticket_number}` : ""}`}
                  />
                ))}
              </DetailSection>
            )}
            <div className="pt-2">
              <BookingBaggagePanel
                pnr={detail.pnr}
                travelers={detail.passengers.map((p) => ({ name: p.name }))}
                baggage={detail.baggage || []}
                policy={detail.baggage_policy}
                baggageFeesTotal={detail.baggage_fees_total}
                onUpdated={async () => {
                  await reloadDetail(detail.pnr);
                  refresh();
                }}
              />
            </div>
          </>
        )}
        {!detailLoading && !detail && selectedRow && (
          <DetailSection title="Booking">
            <DetailRow label="Flight schedule" value={selectedRow.flight_schedule} />
            <DetailRow label="Payer phone" value={selectedRow.payer_phone} />
            <DetailRow label="Payer email" value={selectedRow.payer_email} />
          </DetailSection>
        )}
      </DetailSheet>
    </div>
  );
}
