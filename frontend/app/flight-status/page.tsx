"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Clock,
  Plane,
  Radio,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/motion/reveal";
import { useLocale } from "@/contexts/locale-context";
import {
  getFlightStatusPageContent,
  statusBadgeClass,
  statusProgress,
} from "@/lib/content/flight-status-page";
import {
  listFlightStatus,
  type FlightStatusRow,
} from "@/services/flightStatus";
import { endpointLabel, formatFlightRouteLabel } from "@/lib/format-airport";
import { cn } from "@/lib/utils";

type SearchTab = "flight" | "route" | "booking";

function formatClock(time: string) {
  if (!time) return "—";
  const parts = time.split(":");
  if (parts.length < 2) return time;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${suffix}`;
}

function formatDisplayDate(dateStr: string, locale: string) {
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString(
      locale === "ar" ? "ar-EG" : "en-GB",
      { weekday: "long", day: "numeric", month: "long", year: "numeric" },
    );
  } catch {
    return dateStr;
  }
}

function relativeUpdated(iso: string, locale: string) {
  if (!iso) return "—";
  const then = new Date(iso.replace(" ", "T")).getTime();
  const diffMin = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (locale === "ar") {
    if (diffMin < 1) return "الآن";
    return `منذ ${diffMin} د`;
  }
  if (diffMin < 1) return "just now";
  if (diffMin === 1) return "1 min ago";
  return `${diffMin} min ago`;
}

export default function FlightStatusPage() {
  const { locale, isRtl } = useLocale();
  const copy = useMemo(() => getFlightStatusPageContent(locale), [locale]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [tab, setTab] = useState<SearchTab>("flight");
  const [date, setDate] = useState(today);
  const [flightNumber, setFlightNumber] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [bookingRef, setBookingRef] = useState("");

  const [flights, setFlights] = useState<FlightStatusRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [scheduleDate, setScheduleDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<FlightStatusRow | null>(null);

  const loadFlights = useCallback(
    async (overrides?: {
      tab?: SearchTab;
      date?: string;
      flightNumber?: string;
      origin?: string;
      destination?: string;
      bookingRef?: string;
    }) => {
      setLoading(true);
      setError("");
      const activeTab = overrides?.tab ?? tab;
      const searchDate = overrides?.date ?? date;

      try {
        const params: Parameters<typeof listFlightStatus>[0] = { date: searchDate };
        if (activeTab === "flight" && (overrides?.flightNumber ?? flightNumber).trim()) {
          params.flight_number = overrides?.flightNumber ?? flightNumber;
        }
        if (activeTab === "route") {
          const o = (overrides?.origin ?? origin).trim();
          const d = (overrides?.destination ?? destination).trim();
          if (o) params.origin = o;
          if (d) params.destination = d;
        }
        if (activeTab === "booking" && (overrides?.bookingRef ?? bookingRef).trim()) {
          params.booking_reference = overrides?.bookingRef ?? bookingRef;
        }

        const result = await listFlightStatus(params);
        setFlights(result.flights);
        setUpdatedAt(result.updated_at);
        setScheduleDate(result.date);
      } catch {
        setError("Could not load flight status. Please try again.");
        setFlights([]);
      } finally {
        setLoading(false);
      }
    },
    [tab, date, flightNumber, origin, destination, bookingRef],
  );

  useEffect(() => {
    loadFlights();
  }, [loadFlights]);

  useEffect(() => {
    const interval = setInterval(() => loadFlights(), 120_000);
    return () => clearInterval(interval);
  }, [loadFlights]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadFlights();
  };

  const handleClear = () => {
    setTab("flight");
    setDate(today);
    setFlightNumber("");
    setOrigin("");
    setDestination("");
    setBookingRef("");
    loadFlights({
      tab: "flight",
      date: today,
      flightNumber: "",
      origin: "",
      destination: "",
      bookingRef: "",
    });
  };

  const statusLabel = (status: string) =>
    copy.statusLabels[status] ?? status;

  return (
    <div className="min-h-screen bg-cream text-navy">
      <Navbar />

      <main className="pt-20">
        <section className="bg-navy text-cream py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-4">
                {copy.hero.eyebrow}
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                {copy.hero.title}
                <br />
                <span className="text-gold">{copy.hero.titleLine2}</span>
              </h1>
              <p className="text-cream/70 max-w-2xl text-lg">{copy.hero.body}</p>
            </Reveal>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <Reveal>
              <div className="rounded-2xl border border-navy/10 bg-white shadow-sm p-6 md:p-8">
                <h2 className="text-xl font-bold text-navy mb-6">{copy.search.title}</h2>

                <div
                  className={cn(
                    "flex flex-wrap gap-2 mb-6",
                    isRtl && "flex-row-reverse",
                  )}
                >
                  {(
                    [
                      ["flight", copy.search.tabFlight],
                      ["route", copy.search.tabRoute],
                      ["booking", copy.search.tabBooking],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                        tab === key
                          ? "bg-navy text-cream"
                          : "bg-cream text-navy/70 hover:bg-navy/5",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSearch} className="space-y-4">
                  {tab === "flight" && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold tracking-wide text-navy/60 mb-2 block">
                          {copy.search.flightNumber}
                        </label>
                        <Input
                          value={flightNumber}
                          onChange={(e) => setFlightNumber(e.target.value)}
                          placeholder="BA101"
                          className="bilan-light-field"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold tracking-wide text-navy/60 mb-2 block">
                          {copy.search.date}
                        </label>
                        <Input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="bilan-light-field"
                        />
                      </div>
                    </div>
                  )}

                  {tab === "route" && (
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold tracking-wide text-navy/60 mb-2 block">
                          {copy.search.origin}
                        </label>
                        <Input
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value)}
                          placeholder="NBO"
                          className="bilan-light-field"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold tracking-wide text-navy/60 mb-2 block">
                          {copy.search.destination}
                        </label>
                        <Input
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                          placeholder="MGQ"
                          className="bilan-light-field"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold tracking-wide text-navy/60 mb-2 block">
                          {copy.search.date}
                        </label>
                        <Input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="bilan-light-field"
                        />
                      </div>
                    </div>
                  )}

                  {tab === "booking" && (
                    <div>
                      <label className="text-xs font-semibold tracking-wide text-navy/60 mb-2 block">
                        {copy.search.bookingRef}
                      </label>
                      <Input
                        value={bookingRef}
                        onChange={(e) => setBookingRef(e.target.value)}
                        placeholder="PNR-2026-00001"
                        className="bilan-light-field max-w-md"
                      />
                    </div>
                  )}

                  <div className={cn("flex flex-wrap gap-3", isRtl && "flex-row-reverse")}>
                    <Button type="submit" className="bg-navy hover:bg-navy-light gap-2">
                      <Search className="w-4 h-4" />
                      {copy.search.searchBtn}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleClear}>
                      {copy.search.clearBtn}
                    </Button>
                  </div>
                </form>
              </div>
            </Reveal>

            <Reveal>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-bold">{copy.schedule.title}</h2>
                  <p className="text-navy/60 text-sm mt-1">
                    {copy.schedule.allFlights} · {formatDisplayDate(scheduleDate, locale)}
                  </p>
                </div>
                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800",
                    isRtl && "flex-row-reverse",
                  )}
                >
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  {copy.schedule.liveUpdates}
                  <span className="text-emerald-600/80">
                    · {copy.schedule.lastUpdated}{" "}
                    {relativeUpdated(updatedAt, locale)}
                  </span>
                  <button
                    type="button"
                    onClick={() => loadFlights()}
                    className="ml-1 p-0.5 hover:text-emerald-950"
                    aria-label="Refresh"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="rounded-2xl border border-navy/10 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-navy/10 bg-navy/5 text-left text-xs uppercase tracking-wide text-navy/60">
                        <th className="px-4 py-3 font-semibold">{copy.schedule.columns.flight}</th>
                        <th className="px-4 py-3 font-semibold">{copy.schedule.columns.route}</th>
                        <th className="px-4 py-3 font-semibold">{copy.schedule.columns.departure}</th>
                        <th className="px-4 py-3 font-semibold">{copy.schedule.columns.arrival}</th>
                        <th className="px-4 py-3 font-semibold">{copy.schedule.columns.terminal}</th>
                        <th className="px-4 py-3 font-semibold">{copy.schedule.columns.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && flights.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-navy/50">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                            Loading…
                          </td>
                        </tr>
                      ) : flights.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-navy/50">
                            {copy.schedule.noFlights}
                          </td>
                        </tr>
                      ) : (
                        flights.map((flight) => (
                          <tr
                            key={flight.schedule_id}
                            onClick={() => setSelected(flight)}
                            className="border-b border-navy/5 hover:bg-gold/5 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-4 font-semibold">{flight.flight_number}</td>
                            <td className="px-4 py-4">
                              {formatFlightRouteLabel(flight)}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-navy/40" />
                                {formatClock(flight.departure_time)}
                              </div>
                            </td>
                            <td className="px-4 py-4">{formatClock(flight.arrival_time)}</td>
                            <td className="px-4 py-4 text-navy/60">{flight.terminal_gate}</td>
                            <td className="px-4 py-4">
                              <span
                                className={cn(
                                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                                  statusBadgeClass(flight.status),
                                )}
                              >
                                {statusLabel(flight.status)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>

            <Reveal>
              <div className="grid md:grid-cols-3 gap-6">
                {(
                  [
                    copy.info.delays,
                    copy.info.baggage,
                    copy.info.disruptions,
                  ] as const
                ).map((card) => (
                  <div
                    key={card.title}
                    className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm"
                  >
                    <h3 className="font-bold mb-2">{card.title}</h3>
                    <p className="text-sm text-navy/70 leading-relaxed">{card.body}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />

      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-navy/60 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-navy/10 px-6 py-4 bg-navy text-cream">
              <div className="flex items-center gap-2">
                <Plane className="w-5 h-5 text-gold" />
                <span className="font-bold">{selected.flight_number}</span>
                <span className="text-cream/60 text-sm">
                  {formatFlightRouteLabel(selected)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-1 hover:text-gold"
                aria-label={copy.detail.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-navy/50 mb-2">
                    {copy.detail.departure}
                  </h4>
                  <p className="font-bold text-lg">{formatClock(selected.departure_time)}</p>
                  <p className="text-sm text-navy/60">
                    {endpointLabel(selected.origin_code, selected.origin_label)}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-navy/50 mb-2">
                    {copy.detail.arrival}
                  </h4>
                  <p className="font-bold text-lg">{formatClock(selected.arrival_time)}</p>
                  <p className="text-sm text-navy/60">
                    {endpointLabel(selected.destination_code, selected.destination_label)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-navy/50 mb-2">
                  {copy.detail.flightInfo}
                </h4>
                <div className="rounded-xl bg-cream/80 p-4 text-sm space-y-1">
                  <p>
                    <span className="text-navy/50">{copy.schedule.columns.status}: </span>
                    <span className="font-medium">{statusLabel(selected.status)}</span>
                  </p>
                  <p>
                    <span className="text-navy/50">{copy.schedule.columns.terminal}: </span>
                    {selected.terminal_gate}
                  </p>
                  <p>
                    <span className="text-navy/50">{copy.detail.aircraft}: </span>
                    {selected.airplane}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-navy/50 mb-3">
                  {copy.detail.progress}
                </h4>
                <div className="relative h-2 rounded-full bg-navy/10 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gold rounded-full transition-all duration-500"
                    style={{ width: `${statusProgress(selected.status)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-navy/50">
                  <span>{endpointLabel(selected.origin_code, selected.origin_label)}</span>
                  <span className="text-lg">✈</span>
                  <span>{endpointLabel(selected.destination_code, selected.destination_label)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
