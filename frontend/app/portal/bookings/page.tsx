"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MoreHorizontal, Ticket } from "lucide-react";
import { listBookings, type AirBookingRow } from "@/services/portal";
import {
  cancelBooking,
  confirmBookingOnCredit,
  fetchBookingDetails,
  type BookingDetails,
} from "@/services/airBooking";
import { ConfirmActionDialog } from "@/components/portal/confirm-action-dialog";
import { ConfirmPaymentDialog } from "@/components/portal/confirm-payment-dialog";
import { openDeskDocument } from "@/services/desk";
import { toast } from "sonner";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { DocLink } from "@/components/portal/doc-link";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { ListSearch } from "@/components/portal/list-search";
import { DisabledActionTooltip } from "@/components/portal/disabled-action-tooltip";
import { PortalBookingSheetFooter } from "@/components/portal/portal-booking-actions";
import { useCurrency } from "@/contexts/currency-context";
import { useBookingAgentCreditEligibility } from "@/hooks/use-booking-agent-credit";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { BookingStartLink } from "@/components/portal/booking-start-link";
import { BookingBaggagePanel } from "@/components/portal/booking-baggage-panel";
import { bookingReference } from "@/lib/booking-reference";
import { isPassengerTicketPrintable } from "@/lib/passenger-ticket";
import { PassengerTicketPrintButton } from "@/components/portal/passenger-ticket-print-button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_STATUSES_VALUE = "__all__";

const RESERVATION_STATUS_OPTIONS = [
  { value: "Booked", label: "Booked" },
  { value: "Confirm", label: "Confirm" },
  { value: "Void", label: "Void" },
  { value: "Flight Taken", label: "Flight Taken" },
] as const;

export default function PortalBookingsPage() {
  const { formatMoney } = useCurrency();
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES_VALUE);
  const fetchBookings = useCallback(
    async (search: string) => {
      const res = await listBookings({
        search: search.trim() || undefined,
        status: statusFilter === ALL_STATUSES_VALUE ? undefined : statusFilter,
        limit: 100,
      });
      return res.data;
    },
    [statusFilter],
  );
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery<AirBookingRow>(
    fetchBookings,
    { reloadKey: statusFilter },
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [detail, setDetail] = useState<BookingDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentDialogPnr, setPaymentDialogPnr] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCreditId, setConfirmingCreditId] = useState<string | null>(null);
  const [creditConfirmRef, setCreditConfirmRef] = useState<string | null>(null);
  const {
    loading: agentCreditLoading,
    canConfirmOnCredit: allowConfirmOnCredit,
    confirmOnCreditDisabledReason,
  } = useBookingAgentCreditEligibility();

  const creditActionEnabled = !agentCreditLoading && allowConfirmOnCredit;
  const creditActionDisabledReason = agentCreditLoading
    ? "Checking your booking agent profile…"
    : confirmOnCreditDisabledReason;

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

  const reservationStatus = (row: AirBookingRow) =>
    row.reservation_status || row.booking_status || "";

  const openDetails = (pnr: string) => {
    setShowCancelForm(false);
    setSelectedId(pnr);
  };

  const closeDetails = () => {
    setSelectedId(null);
    setShowCancelForm(false);
  };

  const handleConfirmOnCredit = async (bookingRef: string) => {
    setConfirmingCreditId(bookingRef);
    try {
      const res = await confirmBookingOnCredit(bookingRef);
      setCreditConfirmRef(null);
      toast.success(res.pnr ? `PNR issued: ${res.pnr}` : "Reservation confirmed on credit.");
      refresh();
      if (selectedId === bookingRef) await reloadDetail(bookingRef);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Confirm on credit failed");
    } finally {
      setConfirmingCreditId(null);
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
            In-office bookings — click reservation ref for details and actions
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/portal/bookings/tickets">
              <Ticket className="mr-2 h-4 w-4 shrink-0" />
              All tickets
            </Link>
          </Button>
          <BookingStartLink>Office booking</BookingStartLink>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ListSearch
          value={search}
          onChange={setSearch}
          placeholder="Search reservation ref, PNR, payer, phone..."
          className="w-full sm:max-w-md"
        />
        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
          <label
            htmlFor="booking-status-filter"
            className="text-sm font-medium text-muted-foreground shrink-0"
          >
            Status
          </label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="booking-status-filter" className="w-full sm:w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES_VALUE}>All statuses</SelectItem>
              {RESERVATION_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reservation</TableHead>
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
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    {search.trim() || statusFilter !== ALL_STATUSES_VALUE
                      ? "No bookings match your filters."
                      : "No bookings yet."}
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
                    <TableCell className="text-muted-foreground">{b.pnr || "—"}</TableCell>
                    <TableCell>{b.flight_schedule}</TableCell>
                    <TableCell>{b.payer_name}</TableCell>
                    <TableCell>{reservationStatus(b)}</TableCell>
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
                            <DropdownMenuItem
                              onClick={() => openDeskDocument("Air Booking", b.name)}
                            >
                              Edit
                            </DropdownMenuItem>
                            {reservationStatus(b) === "Booked" && (
                              <>
                                <DropdownMenuSeparator />
                                <DisabledActionTooltip
                                  disabled={!creditActionEnabled}
                                  reason={creditActionDisabledReason}
                                  side="left"
                                >
                                  <DropdownMenuItem
                                    disabled={
                                      !creditActionEnabled || confirmingCreditId === b.name
                                    }
                                    onClick={() => {
                                      if (creditActionEnabled) setCreditConfirmRef(b.name);
                                    }}
                                  >
                                    Confirm on Credit (PNR)
                                  </DropdownMenuItem>
                                </DisabledActionTooltip>
                              </>
                            )}
                            {isUnpaid(b.payment_status) && (
                              <DropdownMenuItem onClick={() => setPaymentDialogPnr(b.name)}>
                                Confirm payment & invoice
                              </DropdownMenuItem>
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
            ? { label: reservationStatus(selectedRow), variant: "outline" }
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
              cancelling={cancelling}
              onConfirmPayment={() => setPaymentDialogPnr(selectedId)}
              onConfirmCreditComplete={async () => {
                refresh();
                if (selectedId) await reloadDetail(selectedId);
              }}
              allowConfirmOnCredit={creditActionEnabled}
              confirmOnCreditDisabledReason={creditActionDisabledReason}
              onSubmitCancel={handleCancelBooking}
            />
          ) : undefined
        }
      >
        {detail && (
          <>
            <DetailSection title="Booking">
              <DetailRow label="Reservation" value={detail.reservation_ref} />
              <DetailRow label="PNR" value={detail.pnr || "—"} />
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
                <div className="space-y-3">
                  {detail.passengers.map((p, index) => (
                    <div
                      key={p.row_name || `${p.name}-${index}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{p.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {p.type} · seat {p.seat_label || p.seat}
                          {p.ticket_number ? ` · ticket ${p.ticket_number}` : ""}
                        </p>
                      </div>
                      {isPassengerTicketPrintable(detail, p) ? (
                        <PassengerTicketPrintButton
                          bookingRef={bookingReference(detail)}
                          passengerRow={p.row_name}
                          passengerIndex={index}
                          passengerName={p.name}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </DetailSection>
            )}
            <div className="pt-2">
              <BookingBaggagePanel
                bookingRef={bookingReference(detail)}
                travelers={detail.passengers.map((p) => ({ name: p.name }))}
                baggage={detail.baggage || []}
                policy={detail.baggage_policy}
                baggageFeesTotal={detail.baggage_fees_total}
                onUpdated={async () => {
                  await reloadDetail(bookingReference(detail));
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

      <ConfirmActionDialog
        open={!!creditConfirmRef}
        onOpenChange={(open) => !open && setCreditConfirmRef(null)}
        title="Confirm on agent credit?"
        description={
          creditConfirmRef ? (
            <>
              <p>
                Reservation{" "}
                <span className="font-mono font-medium text-foreground">{creditConfirmRef}</span>{" "}
                will be confirmed on your agent credit account.
              </p>
              <p>
                A PNR will be issued and the total fare will be deducted from the agent credit limit.
              </p>
            </>
          ) : null
        }
        confirmLabel="Confirm on credit"
        loading={!!creditConfirmRef && confirmingCreditId === creditConfirmRef}
        onConfirm={() => {
          if (creditConfirmRef) void handleConfirmOnCredit(creditConfirmRef);
        }}
      />

      <ConfirmPaymentDialog
        open={!!paymentDialogPnr}
        pnr={paymentDialogPnr}
        onOpenChange={(open) => !open && setPaymentDialogPnr(null)}
        onSuccess={(pnr) => {
          toast.success("Payment confirmed and sales invoice created");
          refresh();
          if (selectedId === pnr) void reloadDetail(pnr);
        }}
      />
    </div>
  );
}
