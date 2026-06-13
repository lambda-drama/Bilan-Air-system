"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { PortalMasterPageHeader } from "@/components/portal/portal-master-page-header";
import { fetchAirportsForPortal } from "@/services/airport";
import { buildAirportSelectOptions, type AirportSelectRow } from "@/lib/airport-select";
import { buildAirportDisplayByLinkName } from "@/lib/format-airport";
import {
  buildRouteFarePayload,
  emptyPassengerFaresForm,
  faresFromRouteRow,
  faresToForm,
  formatFaresSummary,
  PASSENGER_FARE_KEYS,
  PASSENGER_FARE_LABELS,
  type PassengerBaseFaresForm,
} from "@/lib/passenger-base-fares";
import { getFlightRoute, saveRoute, type RouteSegmentRow } from "@/services/flightRoute";
import { listAirlines, listFlightRoutes } from "@/services/portalMaster";
import {
  BilanFormDialog,
  FormField,
  FormGrid,
  FormSection,
} from "@/components/portal/form-dialog";
import { getMissingRequired } from "@/lib/validate-form";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
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
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/portal/searchable-select";

type SegmentForm = {
  segment_index: number;
  origin_airport: string;
  destination_airport: string;
  duration_hours: string;
};

const emptyRouteForm = {
  origin_airport: "",
  destination_airport: "",
  distance_km: "",
  airline: "",
  duration_hours: "",
  is_active: true,
  is_multi_segment: false,
  notes: "",
};

function reindexSegments(segments: SegmentForm[]): SegmentForm[] {
  return segments.map((s, i) => ({ ...s, segment_index: i }));
}

function defaultMultiSegments(origin = "", destination = ""): SegmentForm[] {
  return reindexSegments([
    { segment_index: 0, origin_airport: origin, destination_airport: "", duration_hours: "" },
    { segment_index: 1, origin_airport: "", destination_airport: destination, duration_hours: "" },
  ]);
}

function segmentDurationHours(durationSeconds?: number | null) {
  const sec = Number(durationSeconds || 0);
  return sec > 0 ? String(sec / 3600) : "";
}

function segmentDurationPayload(hours: string) {
  const parsed = parseFloat(hours);
  return parsed > 0 ? Math.round(parsed * 3600) : undefined;
}

function validateSegments(
  segments: SegmentForm[],
  airportLabelByName: Map<string, string>,
): string[] {
  const errors: string[] = [];
  if (segments.length < 1) {
    errors.push("Add at least one flight segment");
    return errors;
  }
  if (segments.length < 2) {
    errors.push("Multi-stop routes need at least two legs (e.g. ADI→NBO, then NBO→MBA)");
  }
  segments.forEach((seg, i) => {
    const n = i + 1;
    if (!seg.origin_airport) errors.push(`Segment ${n}: from airport is required`);
    if (!seg.destination_airport) errors.push(`Segment ${n}: to airport is required`);
    if (seg.origin_airport && seg.destination_airport && seg.origin_airport === seg.destination_airport) {
      errors.push(`Segment ${n}: from and to must differ`);
    }
    if (i > 0) {
      const prev = segments[i - 1];
      if (
        seg.origin_airport &&
        prev.destination_airport &&
        seg.origin_airport !== prev.destination_airport
      ) {
        const prevLabel = airportLabelByName.get(prev.destination_airport) || prev.destination_airport;
        errors.push(`Segment ${n}: must depart from ${prevLabel} (end of previous segment)`);
      }
    }
  });
  return errors;
}

export default function PortalRoutesPage() {
  const { formatMoney } = useCurrency();
  const fetchRows = useCallback(async (search: string) => {
    const res = await listFlightRoutes({ limit: 200, search: search.trim() || undefined });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery(fetchRows);
  const [airports, setAirports] = useState<AirportSelectRow[]>([]);
  const [airlines, setAirlines] = useState<{ name: string; airline_name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(emptyRouteForm);
  const [segments, setSegments] = useState<SegmentForm[]>([]);
  const [baseFaresForm, setBaseFaresForm] = useState<PassengerBaseFaresForm>(emptyPassengerFaresForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailSegments, setDetailSegments] = useState<RouteSegmentRow[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const formAlerts = useFormDialogAlerts();

  useEffect(() => {
    fetchAirportsForPortal()
      .then(setAirports)
      .catch(() => setAirports([]));
    listAirlines({ limit: 200 }).then((r) => setAirlines(r.data as { name: string; airline_name: string }[]));
  }, []);

  const airportOptions = useMemo(() => buildAirportSelectOptions(airports), [airports]);
  const airportLabelByName = useMemo(() => buildAirportDisplayByLinkName(airports), [airports]);

  const routeAirportLabel = useCallback(
    (row: Record<string, unknown>, end: "origin" | "destination") => {
      const labelKey = end === "origin" ? "origin_airport_label" : "destination_airport_label";
      if (row[labelKey]) return String(row[labelKey]);
      const link = String(row[end === "origin" ? "origin_airport" : "destination_airport"] || "");
      return airportLabelByName.get(link) || link || "—";
    },
    [airportLabelByName],
  );

  const airlineOptions = useMemo(
    () =>
      airlines.map((a) => ({
        value: a.name,
        label: a.airline_name || a.name,
      })),
    [airlines],
  );

  const applyRouteToForm = (row: Record<string, unknown>, segs: RouteSegmentRow[]) => {
    const durationSec = Number(row.duration || 0);
    const isMulti = !!row.is_multi_segment;
    setForm({
      origin_airport: String(row.origin_airport || ""),
      destination_airport: String(row.destination_airport || ""),
      distance_km: String(row.distance_km ?? ""),
      airline: String(row.airline || ""),
      duration_hours: durationSec ? String(durationSec / 3600) : "",
      is_active: !!row.is_active,
      is_multi_segment: isMulti,
      notes: String(row.notes || ""),
    });
    setSegments(
      isMulti && segs.length
        ? reindexSegments(
            segs.map((s) => ({
              segment_index: Number(s.segment_index),
              origin_airport: String(s.origin_airport || ""),
              destination_airport: String(s.destination_airport || ""),
              duration_hours: segmentDurationHours(s.duration),
            })),
          )
        : [],
    );
    setBaseFaresForm(faresToForm(faresFromRouteRow(row) ?? undefined));
  };

  const openCreate = () => {
    formAlerts.clearAlerts();
    setEditing(null);
    setForm(emptyRouteForm);
    setSegments([]);
    setBaseFaresForm(emptyPassengerFaresForm());
    setOpen(true);
  };

  const openEdit = async (row: Record<string, unknown>) => {
    formAlerts.clearAlerts();
    setEditing(row);
    setLoadingRoute(true);
    setOpen(true);
    try {
      const full = await getFlightRoute(String(row.name));
      applyRouteToForm(full, (full.route_segments as RouteSegmentRow[]) || []);
    } catch {
      applyRouteToForm(row, []);
    } finally {
      setLoadingRoute(false);
    }
  };

  const handleMultiSegmentToggle = (checked: boolean) => {
    if (checked) {
      setForm({ ...form, is_multi_segment: true });
      setSegments(
        segments.length >= 2
          ? reindexSegments(segments)
          : defaultMultiSegments(form.origin_airport, form.destination_airport),
      );
    } else {
      const first = segments[0];
      const last = segments[segments.length - 1];
      setForm({
        ...form,
        is_multi_segment: false,
        origin_airport: first?.origin_airport || form.origin_airport,
        destination_airport: last?.destination_airport || form.destination_airport,
      });
      setSegments([]);
    }
  };

  const updateSegment = (index: number, patch: Partial<SegmentForm>) => {
    setSegments((prev) =>
      reindexSegments(prev.map((s, i) => (i === index ? { ...s, ...patch } : s))),
    );
  };

  const addSegment = () => {
    setSegments((prev) => {
      const last = prev[prev.length - 1];
      return reindexSegments([
        ...prev,
        {
          segment_index: prev.length,
          origin_airport: last?.destination_airport || "",
          destination_airport: "",
          duration_hours: "",
        },
      ]);
    });
  };

  const removeSegment = (index: number) => {
    setSegments((prev) => reindexSegments(prev.filter((_, i) => i !== index)));
  };

  const handleSave = async () => {
    const extra: string[] = [];
    const distanceKm = parseFloat(form.distance_km);
    const routeFares = buildRouteFarePayload(baseFaresForm);

    if (!distanceKm || distanceKm <= 0) extra.push("Distance (km) must be greater than zero");
    if (!baseFaresForm.adult.trim()) extra.push("Adult base fare");
    if (!routeFares) extra.push("Enter valid base fares (adult required)");

    if (form.is_multi_segment) {
      extra.push(...validateSegments(segments, airportLabelByName));
    } else {
      extra.push(
        ...getMissingRequired(form, [
          { key: "origin_airport", label: "Origin airport" },
          { key: "destination_airport", label: "Destination airport" },
        ]),
      );
      if (form.origin_airport === form.destination_airport) {
        extra.push("Origin and destination must differ");
      }
    }

    if (extra.length) {
      formAlerts.showValidation(extra);
      return;
    }

    const durationHours = parseFloat(form.duration_hours);
    const indexedSegments = reindexSegments(segments);
    const payload: Record<string, unknown> = {
      ...(editing?.name ? { name: editing.name } : {}),
      is_multi_segment: form.is_multi_segment ? 1 : 0,
      distance_km: distanceKm,
      ...routeFares,
      is_active: form.is_active ? 1 : 0,
      notes: form.notes || undefined,
      airline: form.airline || undefined,
    };

    if (form.is_multi_segment) {
      payload.route_segments = indexedSegments.map((seg) => ({
        segment_index: seg.segment_index,
        origin_airport: seg.origin_airport,
        destination_airport: seg.destination_airport,
        duration: segmentDurationPayload(seg.duration_hours),
      }));
      payload.origin_airport = indexedSegments[0]?.origin_airport;
      payload.destination_airport = indexedSegments[indexedSegments.length - 1]?.destination_airport;
      const totalSegmentSeconds = indexedSegments.reduce(
        (sum, seg) => sum + (segmentDurationPayload(seg.duration_hours) || 0),
        0,
      );
      if (totalSegmentSeconds > 0) {
        payload.duration = totalSegmentSeconds;
      } else if (durationHours > 0) {
        payload.duration = Math.round(durationHours * 3600);
      }
    } else {
      payload.origin_airport = form.origin_airport;
      payload.destination_airport = form.destination_airport;
      payload.route_segments = [];
      if (durationHours > 0) payload.duration = Math.round(durationHours * 3600);
    }

    formAlerts.clearAlerts();
    try {
      await saveRoute(payload);
      setOpen(false);
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save route");
    }
  };

  const selectedRoute = rows.find((r) => String(r.name) === selectedId);

  useEffect(() => {
    if (!selectedId || !selectedRoute?.is_multi_segment) {
      setDetailSegments([]);
      return;
    }
    getFlightRoute(selectedId)
      .then((r) => setDetailSegments((r.route_segments as RouteSegmentRow[]) || []))
      .catch(() => setDetailSegments([]));
  }, [selectedId, selectedRoute?.is_multi_segment]);

  return (
    <div className="space-y-6">
      <PortalMasterPageHeader
        title="Routes"
        description="Flight paths, fares, and multi-stop segments — managed in the portal"
        addLabel="New route"
        onAdd={openCreate}
      />

      <ListSearch value={search} onChange={setSearch} placeholder="Search route, origin, destination..." />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Airline</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Base fares</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No routes found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={String(r.name)}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(String(r.name))}
                  >
                    <TableCell className="font-medium">{String(r.route_name || r.name)}</TableCell>
                    <TableCell>
                      {r.is_multi_segment ? (
                        <span className="text-xs font-medium text-navy">
                          Multi-stop ({String(r.segment_count || "—")} legs)
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Direct</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm">
                      {String(r.segments_summary || `${routeAirportLabel(r, "origin")} → ${routeAirportLabel(r, "destination")}`)}
                    </TableCell>
                    <TableCell>{String(r.airline || "—")}</TableCell>
                    <TableCell>{String(r.distance_km ?? "—")}</TableCell>
                    <TableCell className="text-sm">
                      {formatFaresSummary(
                        faresFromRouteRow(r),
                        formatMoney,
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ListRowActions doctype="Flight Route" docName={String(r.name)}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(r)}>Edit</DropdownMenuItem>
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

      <BilanFormDialog
        open={open}
        onOpenChange={setOpen}
        className="sm:max-w-3xl"
        title={editing ? "Edit route" : "New route"}
        description="Route name and flight series are generated automatically. Use multi-stop for flights like Mogadishu → Nairobi → Mombasa."
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loadingRoute}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold-dark"
              onClick={handleSave}
              disabled={loadingRoute}
            >
              Save
            </Button>
          </>
        }
      >
        {loadingRoute ? (
          <p className="py-8 text-center text-muted-foreground">Loading route...</p>
        ) : (
          <>
            <FormSection title="Route type">
              <FormField
                label="Multi-stop route"
                fullWidth
                hint="When enabled, define each leg (e.g. MGQ→NBO, NBO→MBA). Passengers can book any valid segment pair on the same flight."
              >
                <div className="flex h-9 items-center gap-2">
                  <Switch
                    checked={form.is_multi_segment}
                    onCheckedChange={handleMultiSegmentToggle}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.is_multi_segment
                      ? "Multi-stop — configure segments below"
                      : "Direct — single origin and destination"}
                  </span>
                </div>
              </FormField>
            </FormSection>

            {form.is_multi_segment ? (
              <FormSection title="Flight segments" className="mt-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  Each row is one leg. The next leg must start where the previous leg ends. The route
                  ID is the full path (e.g. ADI→NBO→MBA becomes <strong>ADI-NBO-MBA</strong>), separate
                  from a direct <strong>ADI-NBO</strong> route.
                </p>
                <div className="space-y-3 rounded-lg border p-3">
                  {segments.map((seg, index) => (
                    <div
                      key={index}
                      className="grid gap-3 rounded-md border border-dashed bg-muted/30 p-3 sm:grid-cols-[auto_1fr_1fr_120px_auto]"
                    >
                      <span className="flex h-9 items-center text-sm font-medium text-muted-foreground">
                        Leg {index + 1}
                      </span>
                      <FormField label="From" required>
                        <SearchableSelect
                          options={airportOptions}
                          value={seg.origin_airport}
                          onValueChange={(v) => updateSegment(index, { origin_airport: v })}
                          placeholder="Boarding airport"
                          clearable={false}
                        />
                      </FormField>
                      <FormField label="To" required>
                        <SearchableSelect
                          options={airportOptions}
                          value={seg.destination_airport}
                          onValueChange={(v) => updateSegment(index, { destination_airport: v })}
                          placeholder="Arrival airport"
                          clearable={false}
                        />
                      </FormField>
                      <FormField label="Duration (h)" hint="Est.">
                        <Input
                          type="number"
                          min={0}
                          step={0.25}
                          value={seg.duration_hours}
                          onChange={(e) => updateSegment(index, { duration_hours: e.target.value })}
                          placeholder="e.g. 2"
                        />
                      </FormField>
                      <div className="flex items-end pb-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={segments.length <= 2}
                          onClick={() => removeSegment(index)}
                          aria-label="Remove segment"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addSegment}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add leg
                  </Button>
                </div>
                {segments.length >= 2 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Full route: {segments[0]?.origin_airport ? airportLabelByName.get(segments[0].origin_airport) || segments[0].origin_airport : "—"}
                    {" → … → "}
                    {segments[segments.length - 1]?.destination_airport
                      ? airportLabelByName.get(segments[segments.length - 1].destination_airport) ||
                        segments[segments.length - 1].destination_airport
                      : "—"}
                  </p>
                )}
              </FormSection>
            ) : (
              <FormSection title="Airports" className="mt-4">
                <FormGrid>
                  <FormField label="Origin airport" required>
                    <SearchableSelect
                      options={airportOptions}
                      value={form.origin_airport}
                      onValueChange={(v) => setForm({ ...form, origin_airport: v })}
                      placeholder="Search airport..."
                      clearable={false}
                    />
                  </FormField>
                  <FormField label="Destination airport" required>
                    <SearchableSelect
                      options={airportOptions}
                      value={form.destination_airport}
                      onValueChange={(v) => setForm({ ...form, destination_airport: v })}
                      placeholder="Search airport..."
                      clearable={false}
                    />
                  </FormField>
                </FormGrid>
              </FormSection>
            )}

            <FormSection title="Commercial" className="mt-4">
              <FormGrid>
                <FormField label="Airline">
                  <SearchableSelect
                    options={airlineOptions}
                    value={form.airline}
                    onValueChange={(v) => setForm({ ...form, airline: v })}
                    placeholder="Optional"
                  />
                </FormField>
                <FormField label="Distance (km)" required>
                  <Input
                    type="number"
                    min={1}
                    value={form.distance_km}
                    onChange={(e) => setForm({ ...form, distance_km: e.target.value })}
                  />
                </FormField>
                {PASSENGER_FARE_KEYS.map((key) => (
                  <FormField
                    key={key}
                    label={`${PASSENGER_FARE_LABELS[key]} base fare`}
                    required={key === "adult"}
                    hint={key !== "adult" ? "Optional — defaults from BA Settings if empty" : undefined}
                  >
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={baseFaresForm[key]}
                      onChange={(e) =>
                        setBaseFaresForm({ ...baseFaresForm, [key]: e.target.value })
                      }
                    />
                  </FormField>
                ))}
                <FormField
                  label="Duration (hours)"
                  hint={
                    form.is_multi_segment
                      ? "Optional total — auto-summed from leg durations when provided"
                      : "Estimated flying time for this direct route"
                  }
                >
                  <Input
                    type="number"
                    min={0}
                    step={0.25}
                    value={form.duration_hours}
                    onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
                  />
                </FormField>
                <FormField label="Active" fullWidth>
                  <div className="flex h-9 items-center gap-2">
                    <Switch
                      checked={form.is_active}
                      onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                    />
                    <span className="text-sm text-muted-foreground">Available for booking</span>
                  </div>
                </FormField>
              </FormGrid>
            </FormSection>

            <FormField label="Notes" fullWidth className="mt-4">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </FormField>
          </>
        )}
      </BilanFormDialog>

      <DetailSheet
        open={!!selectedId}
        onOpenChange={(isOpen) => !isOpen && setSelectedId(null)}
        title={String(selectedRoute?.route_name || selectedId || "")}
        subtitle={selectedId || undefined}
      >
        {selectedRoute && (
          <>
            <DetailSection title="Route">
              <DetailRow
                label="Type"
                value={
                  selectedRoute.is_multi_segment
                    ? `Multi-stop (${String(selectedRoute.segment_count || "")} legs)`
                    : "Direct"
                }
              />
              <DetailRow
                label="Path"
                value={String(
                  selectedRoute.segments_summary ||
                    `${routeAirportLabel(selectedRoute, "origin")} → ${routeAirportLabel(selectedRoute, "destination")}`,
                )}
              />
              <DetailRow label="Origin" value={routeAirportLabel(selectedRoute, "origin")} />
              <DetailRow label="Destination" value={routeAirportLabel(selectedRoute, "destination")} />
              <DetailRow label="Airline" value={String(selectedRoute.airline || "—")} />
              <DetailRow label="Distance (km)" value={String(selectedRoute.distance_km ?? "—")} />
              <DetailRow
                label="Base fares"
                value={formatFaresSummary(faresFromRouteRow(selectedRoute), formatMoney)}
              />
              <DetailRow label="Active" value={selectedRoute.is_active ? "Yes" : "No"} />
              <DetailRow label="Notes" value={String(selectedRoute.notes || "")} />
            </DetailSection>
            {selectedRoute.is_multi_segment && detailSegments.length > 0 && (
              <DetailSection title="Segments">
                {detailSegments.map((seg, i) => {
                  const legHours = segmentDurationHours(seg.duration);
                  const path = `${airportLabelByName.get(seg.origin_airport) || seg.origin_airport} → ${airportLabelByName.get(seg.destination_airport) || seg.destination_airport}`;
                  return (
                    <DetailRow
                      key={i}
                      label={`Leg ${i + 1}`}
                      value={legHours ? `${path} (${legHours} h est.)` : path}
                    />
                  );
                })}
              </DetailSection>
            )}
          </>
        )}
      </DetailSheet>
    </div>
  );
}
