"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Armchair, Loader2, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { SeatMapGrid, SeatMapLegend } from "@/components/portal/seat-map-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureScheduleSeats, listSchedules } from "@/services/flightSchedule";
import {
  getScheduleSeatInventory,
  portalHoldSeat,
  portalReleaseSeat,
  portalReleaseSeatForSale,
  portalRestrictSeat,
  type PortalSeatRow,
  type ScheduleSeatInventory,
} from "@/services/seatInventoryPortal";
import { cn } from "@/lib/utils";

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold", tone)}>{value}</p>
    </div>
  );
}

function SeatInventoryContent() {
  const searchParams = useSearchParams();
  const initialSchedule = searchParams.get("schedule") || "";

  const [scheduleSearch, setScheduleSearch] = useState("");
  const [scheduleOptions, setScheduleOptions] = useState<{ value: string; label: string }[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(initialSchedule);
  const [inventory, setInventory] = useState<ScheduleSeatInventory | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeClass, setActiveClass] = useState<string>("All");
  const [selectedSeat, setSelectedSeat] = useState<PortalSeatRow | null>(null);
  const [holdPnr, setHoldPnr] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const loadRequestRef = useRef(0);

  const loadSchedules = useCallback(async (search: string) => {
    setSchedulesLoading(true);
    try {
      const res = await listSchedules({ limit: 50, search: search.trim() || undefined });
      setScheduleOptions(
        res.data.map((s) => ({
          value: s.name,
          label: `${s.flight_number} · ${s.departure_date} · ${s.route}`,
        })),
      );
    } catch {
      setScheduleOptions([]);
    } finally {
      setSchedulesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules("");
  }, [loadSchedules]);

  useEffect(() => {
    const t = setTimeout(() => loadSchedules(scheduleSearch), 300);
    return () => clearTimeout(t);
  }, [scheduleSearch, loadSchedules]);

  const loadInventory = useCallback(async (scheduleName: string) => {
    if (!scheduleName) {
      setInventory(null);
      setLoading(false);
      return;
    }
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    try {
      const data = await getScheduleSeatInventory(scheduleName);
      if (requestId !== loadRequestRef.current) return;
      setInventory(data);
      setActiveClass("All");
      if (data.schedule.name && data.schedule.name !== scheduleName) {
        setSelectedSchedule(data.schedule.name);
      }
    } catch (e) {
      if (requestId !== loadRequestRef.current) return;
      setInventory(null);
      toast.error(e instanceof Error ? e.message : "Could not load seat inventory");
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadInventory(selectedSchedule);
  }, [selectedSchedule, loadInventory]);

  useEffect(() => {
    if (!selectedSchedule) return;
    const current = searchParams.get("schedule");
    if (current === selectedSchedule) return;
    const params = new URLSearchParams(window.location.search);
    params.set("schedule", selectedSchedule);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(window.history.state, "", next);
  }, [selectedSchedule, searchParams]);

  useEffect(() => {
    if (initialSchedule && initialSchedule !== selectedSchedule) {
      setSelectedSchedule(initialSchedule);
    }
  }, [initialSchedule]);

  const classTabs = useMemo(() => {
    if (!inventory) return ["All"];
    return ["All", ...Object.keys(inventory.seats_by_class).sort()];
  }, [inventory]);

  const visibleSeats = useMemo(() => {
    if (!inventory) return [];
    if (activeClass === "All") return inventory.seats;
    return inventory.seats_by_class[activeClass] || [];
  }, [inventory, activeClass]);

  const generateMissingSeats = async () => {
    if (!selectedSchedule) return;
    setGenerating(true);
    try {
      const res = await ensureScheduleSeats(selectedSchedule);
      await loadInventory(selectedSchedule);
      toast.success(
        res.uses_plan_quotas
          ? "Seat inventory synced from recurring plan"
          : "Seat inventory updated from airplane layout",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate seats");
    } finally {
      setGenerating(false);
    }
  };

  const refreshSeatInView = (updated: PortalSeatRow) => {
    setSelectedSeat(updated);
    setInventory((prev) => {
      if (!prev) return prev;
      const seats = prev.seats.map((s) => (s.name === updated.name ? updated : s));
      const seats_by_class = { ...prev.seats_by_class };
      for (const key of Object.keys(seats_by_class)) {
        seats_by_class[key] = seats_by_class[key].map((s) =>
          s.name === updated.name ? updated : s,
        );
      }
      const stats = { ...prev.stats };
      for (const k of Object.keys(stats)) stats[k] = 0;
      for (const s of seats) {
        stats[s.status] = (stats[s.status] || 0) + 1;
      }
      return { ...prev, seats, seats_by_class, stats };
    });
  };

  const handleHold = async (withPnr: boolean) => {
    if (!selectedSeat) return;
    setActionLoading(true);
    try {
      const updated = await portalHoldSeat(
        selectedSeat.name,
        withPnr ? holdPnr.trim() : undefined,
      );
      refreshSeatInView(updated);
      toast.success(withPnr ? `Seat held for ${holdPnr.trim()}` : "Seat held (agent)");
      setHoldPnr("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not hold seat");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearHold = async () => {
    if (!selectedSeat) return;
    setActionLoading(true);
    try {
      const updated = await portalReleaseSeat(selectedSeat.name);
      refreshSeatInView(updated);
      toast.success(`Seat ${updated.seat_number} is available again`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear hold");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseForSale = async () => {
    if (!selectedSeat) return;
    setActionLoading(true);
    try {
      const updated = await portalReleaseSeatForSale(selectedSeat.name);
      refreshSeatInView(updated);
      toast.success(`Seat ${updated.seat_number} released for sale`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not release seat for sale");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestrict = async () => {
    if (!selectedSeat) return;
    setActionLoading(true);
    try {
      const updated = await portalRestrictSeat(selectedSeat.name);
      refreshSeatInView(updated);
      toast.success(`Seat ${updated.seat_number} restricted from sale`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restrict seat");
    } finally {
      setActionLoading(false);
    }
  };

  const seatStatus = selectedSeat?.status;
  const canHold = seatStatus === "Available";
  const canClearHold = seatStatus === "Hold" || seatStatus === "Reserved";
  const canReleaseForSale = seatStatus === "Unreleased";
  const canRestrict = seatStatus === "Available";
  const isBooked = seatStatus === "Booked";
  const isOccupied = seatStatus === "Occupied";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Armchair className="h-7 w-7 text-gold" />
          Seat inventory
        </h1>
        <p className="text-muted-foreground mt-1">
          View seat map distribution, spot missing seats, and hold or release seats for a flight.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select flight</CardTitle>
          <CardDescription>Choose a schedule to load its seat map</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xl">
            <SearchableSelect
              options={scheduleOptions}
              value={selectedSchedule}
              onValueChange={setSelectedSchedule}
              onSearchChange={setScheduleSearch}
              placeholder="Search flight number, route, or schedule ID"
              emptyMessage="No matching schedules"
              isLoading={schedulesLoading}
              valueLabel={
                inventory?.schedule.flight_number
                  ? `${inventory.schedule.flight_number} · ${inventory.schedule.departure_date}`
                  : selectedSchedule
              }
              clearable
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading seat map…
        </div>
      ) : inventory ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{inventory.schedule.flight_number}</h2>
              <p className="text-sm text-muted-foreground">
                {inventory.schedule.origin} → {inventory.schedule.destination} ·{" "}
                {inventory.schedule.departure_date} {inventory.schedule.departure_time} ·{" "}
                {inventory.schedule.airplane}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => loadInventory(selectedSchedule)}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              {inventory.missing_seats > 0 && (
                <Button
                  size="sm"
                  className="bg-gold text-navy hover:bg-gold-dark"
                  disabled={generating}
                  onClick={generateMissingSeats}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Wrench className="h-4 w-4 mr-1" />
                  )}
                  Generate missing seats ({inventory.missing_seats})
                </Button>
              )}
            </div>
          </div>

          {inventory.schedule.uses_plan_quotas ? (
            <div className="rounded-lg border border-sky-500/40 bg-sky-50 px-4 py-3 text-sm text-sky-950">
              Seat counts come from the linked recurring plan (Use Airplane Seats is off in BA
              Settings). Physical layout seats are not used.
            </div>
          ) : null}

          {inventory.missing_seats > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <strong>{inventory.missing_seats}</strong> seat
              {inventory.missing_seats === 1 ? "" : "s"} missing from inventory (expected{" "}
              {inventory.expected_seats}, have {inventory.total_seats}).
              {inventory.missing_seat_numbers.length > 0 && (
                <span className="block mt-1 text-xs">
                  Examples: {inventory.missing_seat_numbers.slice(0, 12).join(", ")}
                  {inventory.missing_seat_numbers.length > 12 ? "…" : ""}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Available" value={inventory.stats.Available || 0} tone="text-emerald-700" />
            <StatCard label="Unreleased" value={inventory.stats.Unreleased || 0} tone="text-slate-600" />
            <StatCard label="On hold" value={(inventory.stats.Hold || 0) + (inventory.stats.Reserved || 0)} tone="text-amber-700" />
            <StatCard label="Booked" value={inventory.stats.Booked || 0} />
            <StatCard label="Occupied" value={inventory.stats.Occupied || 0} tone="text-red-700" />
            <StatCard label="In inventory" value={inventory.total_seats} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Seat map</CardTitle>
                <SeatMapLegend />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {classTabs.map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setActiveClass(cls)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                      activeClass === cls
                        ? "bg-gold text-navy border-gold"
                        : "bg-background text-muted-foreground hover:border-gold/50",
                    )}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <SeatMapGrid
                seats={visibleSeats}
                selectedSeatId={selectedSeat?.name}
                onSeatClick={setSelectedSeat}
                columns={inventory.schedule.uses_plan_quotas ? 10 : undefined}
                usesPlanQuotas={inventory.schedule.uses_plan_quotas}
              />
              <p className="mt-4 text-xs text-muted-foreground text-center">
                Click a seat to release, hold, restrict, or view details
              </p>
            </CardContent>
          </Card>
        </>
      ) : selectedSchedule ? null : (
        <p className="text-center text-muted-foreground py-12">
          Select a flight schedule above to view its seat inventory.
        </p>
      )}

      <DetailSheet
        open={!!selectedSeat}
        onOpenChange={(open) => !open && setSelectedSeat(null)}
        title={selectedSeat ? `Seat ${selectedSeat.seat_number}` : "Seat"}
        subtitle={selectedSeat?.seat_class_name}
        badge={
          selectedSeat
            ? { label: selectedSeat.status, variant: "secondary" }
            : undefined
        }
        footer={
          selectedSeat ? (
            <div className="flex flex-col gap-3 w-full">
              {canReleaseForSale && (
                <Button
                  className="bg-gold text-navy hover:bg-gold-dark w-full"
                  disabled={actionLoading}
                  onClick={handleReleaseForSale}
                >
                  Release for sale
                </Button>
              )}
              {canHold && (
                <div className="space-y-2">
                  <Label htmlFor="hold-pnr">Hold for booking (PNR) — optional</Label>
                  <Input
                    id="hold-pnr"
                    placeholder="e.g. BA-00001"
                    value={holdPnr}
                    onChange={(e) => setHoldPnr(e.target.value.toUpperCase())}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="bg-gold text-navy hover:bg-gold-dark flex-1"
                      disabled={actionLoading}
                      onClick={() => handleHold(false)}
                    >
                      Hold (agent)
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={actionLoading || !holdPnr.trim()}
                      onClick={() => handleHold(true)}
                    >
                      Hold for PNR
                    </Button>
                  </div>
                </div>
              )}
              {canRestrict && (
                <Button
                  variant="outline"
                  disabled={actionLoading}
                  onClick={handleRestrict}
                  className="w-full"
                >
                  Restrict from sale
                </Button>
              )}
              {canClearHold && (
                <Button
                  variant="destructive"
                  disabled={actionLoading}
                  onClick={handleClearHold}
                  className="w-full"
                >
                  Clear hold
                </Button>
              )}
              {isBooked && (
                <p className="text-xs text-muted-foreground">
                  Booked seats must be changed via the booking record. Open booking{" "}
                  {selectedSeat.booking_reference || "—"} in Desk or Bookings.
                </p>
              )}
              {isOccupied && (
                <p className="text-xs text-muted-foreground">
                  Occupied seats cannot be changed here. Use check-in or booking tools.
                </p>
              )}
            </div>
          ) : undefined
        }
      >
        {selectedSeat && (
          <>
            <DetailSection title="Details">
              <DetailRow label="Seat ID" value={selectedSeat.name} />
              <DetailRow label="Class" value={selectedSeat.seat_class_name} />
              <DetailRow label="Status" value={selectedSeat.status} />
              <DetailRow label="Booking" value={selectedSeat.booking_reference || "—"} />
              <DetailRow label="Hold expires" value={selectedSeat.hold_expiry || "—"} />
            </DetailSection>
          </>
        )}
      </DetailSheet>
    </div>
  );
}

export default function PortalSeatInventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      }
    >
      <SeatInventoryContent />
    </Suspense>
  );
}
