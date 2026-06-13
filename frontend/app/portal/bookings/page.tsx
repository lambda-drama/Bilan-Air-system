"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MoreHorizontal, Plus, Ticket } from "lucide-react";
import { listBookings, type AirBookingRow } from "@/services/portal";
import {
  confirmBookingOnCredit,
  fetchBookingDetails,
  type BookingDetails,
} from "@/services/airBooking";
import {
  CancelBookingDialog,
  type CancelBookingTarget,
} from "@/components/portal/cancel-booking-dialog";
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
import { clearPortalPointerLocks } from "@/lib/portal-pointer-lock";
import { isPassengerTicketPrintable } from "@/lib/passenger-ticket";
import { PassengerTicketPrintButton } from "@/components/portal/passenger-ticket-print-button";
import { StatusBadge } from "@/components/portal/status-badge";
import {
  paymentStatusStyle,
  reservationStatusStyle,
} from "@/lib/portal-status-styles";
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
const ALL_PAYMENTS_VALUE = "__all__";

const RESERVATION_STATUS_OPTIONS = [
  { value: "Booked", label: "Booked" },
  { value: "Confirm", label: "Confirm" },
  { value: "Void", label: "Void" },
  { value: "Flight Taken", label: "Flight Taken" },
] as const;

const PAYMENT_STATUS_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "Paid", label: "Paid" },
  { value: "Refunded", label: "Refunded" },
] as const;

function PortalBookingsPageContent() {
  const searchParams = useSearchParams();
  const { formatMoney } = useCurrency();
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES_VALUE);
  const [paymentFilter, setPaymentFilter] = useState(ALL_PAYMENTS_VALUE);

  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment) {
      setPaymentFilter(payment);
    }
    const status = searchParams.get("status");
    if (status) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  const fetchBookings = useCallback(
    async (search: string) => {
      const res = await listBookings({
        search: search.trim() || undefined,
        status: statusFilter === ALL_STATUSES_VALUE ? undefined : statusFilter,
        payment_status: paymentFilter === ALL_PAYMENTS_VALUE ? undefined : paymentFilter,
        limit: 100,
      });
      return res.data;
    },
    [statusFilter, paymentFilter],
  );
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery<AirBookingRow>(
    fetchBookings,
    { reloadKey: `${statusFilter}:${paymentFilter}` },
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelBookingTarget | null>(null);
  const [detail, setDetail] = useState<BookingDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentDialogPnr, setPaymentDialogPnr] = useState<string | null>(null);
  const [confirmingCreditId, setConfirmingCreditId] = useState<string | null>(null);
  const [creditConfirmRef, setCreditConfirmRef] = useState<string | null>(null);
  const {
    loading: agentCreditLoading,
    canConfirmOnCredit: allowConfirmOnCredit,
    confirmOnCreditDisabledReason,
  } = useBookingAgentCreditEligibility();

  const creditActionEnabled =
    !agentCreditLoading && allowConfirmOnCredit && !detail?.flight?.only_prepayment;
  const creditActionDisabledReason = agentCreditLoading
    ? "Checking your booking agent profile…"
    : detail?.flight?.only_prepayment
      ? "This flight requires pre-payment. Use Confirm payment instead."
      : confirmOnCreditDisabledReason;

  useEffect(() => {
    clearPortalPointerLocks();
    return () => clearPortalPointerLocks();
  }, []);

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
    setSelectedId(pnr);
  };

  const closeDetails = () => {
    setSelectedId(null);
  };

  const isCancelledBooking = (row: AirBookingRow) => {
    const status = reservationStatus(row);
    return status === "Void" || status === "Cancelled";
  };

  const cancelTargetFromRow = (row: AirBookingRow): CancelBookingTarget => ({
    name: row.name,
    pnr: row.pnr,
    payer_name: row.payer_name,
    payment_status: row.payment_status,
    total_fare: row.total_fare,
    reservation_status: row.reservation_status,
    booking_status: row.booking_status,
  });

  const openCancelDialog = (row: AirBookingRow) => {
    closeDetails();
    setCancelTarget(cancelTargetFromRow(row));
  };

  const handleCancelSuccess = async (
    bookingRef: string,
    refund?: {
      return_invoice_number?: string;
      refund_payment_entry?: string;
      refund_type?: string;
      refund_amount?: number | null;
    } | null,
  ) => {
    if (refund?.return_invoice_number) {
      const payout = refund.refund_payment_entry
        ? ` · refund payment ${refund.refund_payment_entry}`
        : "";
      toast.success(
        `Booking cancelled — return invoice ${refund.return_invoice_number}${payout}`,
      );
    } else {
      toast.success("Booking cancelled");
    }
    refresh();
    if (selectedId === bookingRef) await reloadDetail(bookingRef);
  };

  const handleConfirmOnCredit = async (bookingRef: string) => {
    setConfirmingCreditId(bookingRef);
    try {
      const res = await confirmBookingOnCredit(bookingRef);
      setCreditConfirmRef(null);
      toast.success(
        [
          res.pnr ? `PNR issued: ${res.pnr}` : "Reservation confirmed on credit.",
          res.invoice ? `Invoice ${res.invoice} created.` : null,
        ]
          .filter(Boolean)
          .join(" "),
      );
      refresh();
      if (selectedId === bookingRef) await reloadDetail(bookingRef);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Confirm on credit failed");
    } finally {
      setConfirmingCreditId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center justify-between gap-3 sm:block">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold">Bookings</h2>
            <p className="hidden text-sm text-muted-foreground sm:block">
              In-office bookings — click reservation ref for details and actions
            </p>
          </div>
          <Button
            asChild
            size="icon"
            className="shrink-0 bg-gold text-navy hover:bg-gold-dark sm:hidden"
          >
            <Link href="/portal/booking/new" aria-label="Office booking" onClick={closeDetails}>
              <Plus className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Button variant="outline" asChild className="h-10 w-full sm:w-auto">
            <Link
              href="/portal/bookings/tickets"
              className="inline-flex items-center justify-center"
            >
              <Ticket className="mr-2 h-4 w-4 shrink-0" />
              All tickets
            </Link>
          </Button>
          <BookingStartLink className="hidden sm:inline-flex" onNavigate={closeDetails}>
            Office booking
          </BookingStartLink>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ListSearch
          value={search}
          onChange={setSearch}
          placeholder="Search reservation ref, PNR, payer, phone..."
          className="w-full sm:max-w-md"
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto">
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
          <label
            htmlFor="booking-payment-filter"
            className="text-sm font-medium text-muted-foreground shrink-0"
          >
            Payment
          </label>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger id="booking-payment-filter" className="w-full sm:w-[180px]">
              <SelectValue placeholder="All payments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PAYMENTS_VALUE}>All payments</SelectItem>
              {PAYMENT_STATUS_OPTIONS.map((opt) => (
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
                    {search.trim() ||
                    statusFilter !== ALL_STATUSES_VALUE ||
                    paymentFilter !== ALL_PAYMENTS_VALUE
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
                    <TableCell>
                      <StatusBadge
                        status={reservationStatus(b)}
                        kind="reservation"
                        onFilter={(value) => setStatusFilter(value)}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={b.payment_status}
                        kind="payment"
                        onFilter={(value) => setPaymentFilter(value)}
                      />
                    </TableCell>
                    <TableCell>{formatMoney(b.total_fare)}</TableCell>
                    <TableCell className="text-right">
                      <ListRowActions doctype="Air Booking" docName={b.name}>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {b.payment_status !== "Refunded" ? (
                              <DropdownMenuItem
                                onClick={() => openDeskDocument("Air Booking", b.name)}
                              >
                                Edit
                              </DropdownMenuItem>
                            ) : null}
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
                            {!isCancelledBooking(b) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => openCancelDialog(b)}
                                >
                                  Cancel booking
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
            ? (() => {
                const style = reservationStatusStyle(reservationStatus(selectedRow));
                return {
                  label: style.label,
                  variant: "outline" as const,
                  className: style.className,
                };
              })()
            : undefined
        }
        isLoading={detailLoading}
        footer={
          selectedId ? (
            <PortalBookingSheetFooter
              pnr={selectedId}
              detail={detail}
              row={selectedRow}
              onOpenCancel={() => {
                if (selectedRow) openCancelDialog(selectedRow);
              }}
              onConfirmPayment={() => setPaymentDialogPnr(selectedId)}
              onConfirmCreditComplete={async () => {
                refresh();
                if (selectedId) await reloadDetail(selectedId);
              }}
              allowConfirmOnCredit={creditActionEnabled}
              confirmOnCreditDisabledReason={creditActionDisabledReason}
            />
          ) : undefined
        }
      >
        {detail && (
          <>
            <DetailSection title="Booking">
              <DetailRow label="Reservation" value={detail.reservation_ref} />
              <DetailRow label="PNR" value={detail.pnr || "—"} />
              <DetailRow
                label="Status"
                value={
                  <StatusBadge
                    status={detail.status}
                    kind="reservation"
                    onFilter={(value) => {
                      setStatusFilter(value);
                      closeDetails();
                    }}
                  />
                }
              />
              <DetailRow
                label="Payment"
                value={
                  <StatusBadge
                    status={detail.payment_status}
                    kind="payment"
                    onFilter={(value) => {
                      setPaymentFilter(value);
                      closeDetails();
                    }}
                  />
                }
              />
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
                travelers={detail.passengers.map((p) => ({
                  name: p.name,
                  seat_class: p.seat_class,
                  baggage_policy: p.baggage_policy,
                }))}
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

      {creditConfirmRef ? (
        <ConfirmActionDialog
          open
          onOpenChange={(open) => !open && setCreditConfirmRef(null)}
          title="Confirm on agent credit?"
          description={
            <>
              <p>
                Reservation{" "}
                <span className="font-mono font-medium text-foreground">{creditConfirmRef}</span>{" "}
                will be confirmed on your agent credit account.
              </p>
              <p>
                A PNR will be issued, a sales invoice and payment entry will be created on the
                accounting site, and the total fare will be deducted from the agent credit limit.
              </p>
            </>
          }
          confirmLabel="Confirm on credit"
          loading={confirmingCreditId === creditConfirmRef}
          onConfirm={() => {
            void handleConfirmOnCredit(creditConfirmRef);
          }}
        />
      ) : null}

      {paymentDialogPnr ? (
        <ConfirmPaymentDialog
          open
          pnr={paymentDialogPnr}
          onOpenChange={(open) => !open && setPaymentDialogPnr(null)}
          onSuccess={(pnr) => {
            toast.success("Payment confirmed and sales invoice created");
            refresh();
            if (selectedId === pnr) void reloadDetail(pnr);
          }}
        />
      ) : null}

      {cancelTarget ? (
        <CancelBookingDialog
          open
          booking={cancelTarget}
          onOpenChange={(open) => !open && setCancelTarget(null)}
          onSuccess={handleCancelSuccess}
        />
      ) : null}
    </div>
  );
}

export default function PortalBookingsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <PortalBookingsPageContent />
    </Suspense>
  );
}
