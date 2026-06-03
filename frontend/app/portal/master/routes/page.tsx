"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { fetchAirportsForPortal } from "@/services/airport";
import { buildAirportSelectOptions, type AirportSelectRow } from "@/lib/airport-select";
import { buildAirportDisplayByLinkName } from "@/lib/format-airport";
import {
  emptyPassengerFaresForm,
  faresToForm,
  formatFaresSummary,
  PASSENGER_FARE_KEYS,
  PASSENGER_FARE_LABELS,
  parseBaseFaresInput,
  type PassengerBaseFaresForm,
} from "@/lib/passenger-base-fares";
import { saveRoute } from "@/services/flightRoute";
import { listAirlines, listCurrencies, listFlightRoutes } from "@/services/portalMaster";
import {
  BilanFormDialog,
  FormField,
  FormGrid,
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

const emptyRouteForm = {
  origin_airport: "",
  destination_airport: "",
  distance_km: "",
  airline: "",
  currency: "USD",
  duration_hours: "",
  is_active: true,
  notes: "",
};

export default function PortalRoutesPage() {
  const { formatMoney } = useCurrency();
  const fetchRows = useCallback(async (search: string) => {
    const res = await listFlightRoutes({ limit: 200, search: search.trim() || undefined });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery(fetchRows);
  const [airports, setAirports] = useState<AirportSelectRow[]>([]);
  const [airlines, setAirlines] = useState<{ name: string; airline_name: string }[]>([]);
  const [currencies, setCurrencies] = useState<{ name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(emptyRouteForm);
  const [baseFaresForm, setBaseFaresForm] = useState<PassengerBaseFaresForm>(emptyPassengerFaresForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const formAlerts = useFormDialogAlerts();

  useEffect(() => {
    fetchAirportsForPortal()
      .then(setAirports)
      .catch(() => setAirports([]));
    listAirlines({ limit: 200 }).then((r) => setAirlines(r.data as { name: string; airline_name: string }[]));
    listCurrencies().then(setCurrencies).catch(() => setCurrencies([{ name: "USD" }]));
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

  const currencyOptions = useMemo(
    () => currencies.map((c) => ({ value: c.name, label: c.name })),
    [currencies],
  );

  const openCreate = () => {
    formAlerts.clearAlerts();
    setEditing(null);
    setForm(emptyRouteForm);
    setBaseFaresForm(emptyPassengerFaresForm());
    setOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    formAlerts.clearAlerts();
    setEditing(row);
    const durationSec = Number(row.duration || 0);
    setForm({
      origin_airport: String(row.origin_airport || ""),
      destination_airport: String(row.destination_airport || ""),
      distance_km: String(row.distance_km ?? ""),
      airline: String(row.airline || ""),
      currency: String(row.currency || "USD"),
      duration_hours: durationSec ? String(durationSec / 3600) : "",
      is_active: !!row.is_active,
      notes: String(row.notes || ""),
    });
    setBaseFaresForm(
      faresToForm(
        parseBaseFaresInput(row.base_fares, Number(row.base_fare) || null) ?? undefined,
      ),
    );
    setOpen(true);
  };

  const handleSave = async () => {
    const missing = getMissingRequired(form, [
      { key: "origin_airport", label: "Origin airport" },
      { key: "destination_airport", label: "Destination airport" },
      { key: "distance_km", label: "Distance (km)" },
    ]);
    const extra: string[] = [...missing];
    const distanceKm = parseFloat(form.distance_km);
    const baseFares = parseBaseFaresInput({
      adult: baseFaresForm.adult,
      child: baseFaresForm.child || undefined,
      infant: baseFaresForm.infant || undefined,
    });
    if (!distanceKm || distanceKm <= 0) extra.push("Distance (km) must be greater than zero");
    if (!baseFaresForm.adult.trim()) extra.push("Adult base fare");
    if (!baseFares) extra.push("Enter valid base fares (adult required)");
    if (form.origin_airport === form.destination_airport) {
      extra.push("Origin and destination must differ");
    }

    if (extra.length) {
      formAlerts.showValidation(extra);
      return;
    }

    const durationHours = parseFloat(form.duration_hours);
    const payload: Record<string, unknown> = {
      ...(editing?.name ? { name: editing.name } : {}),
      origin_airport: form.origin_airport,
      destination_airport: form.destination_airport,
      distance_km: distanceKm,
      base_fares: baseFares,
      base_fare: baseFares!.adult,
      is_active: form.is_active ? 1 : 0,
      notes: form.notes || undefined,
      airline: form.airline || undefined,
      currency: form.currency || "USD",
    };
    if (durationHours > 0) payload.duration = Math.round(durationHours * 3600);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Routes</h1>
          <p className="text-muted-foreground">Master data — flight paths, fares, and carriers</p>
        </div>
        <PortalAddButton onClick={openCreate}>New route</PortalAddButton>
      </div>

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
                <TableHead>Origin</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Airline</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Base fares (economy)</TableHead>
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
                    <TableCell>{routeAirportLabel(r, "origin")}</TableCell>
                    <TableCell>{routeAirportLabel(r, "destination")}</TableCell>
                    <TableCell>{String(r.airline || "—")}</TableCell>
                    <TableCell>{String(r.distance_km ?? "—")}</TableCell>
                    <TableCell className="text-sm">
                      {formatFaresSummary(
                        parseBaseFaresInput(r.base_fares, Number(r.base_fare) || null),
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
        className="sm:max-w-2xl"
        title={editing ? "Edit route" : "New route"}
        description="Route name and flight series are generated automatically."
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-gold text-navy hover:bg-gold-dark" onClick={handleSave}>
              Save
            </Button>
          </>
        }
      >
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
          <FormField label="Airline">
            <SearchableSelect
              options={airlineOptions}
              value={form.airline}
              onValueChange={(v) => setForm({ ...form, airline: v })}
              placeholder="Optional"
            />
          </FormField>
          <FormField label="Currency">
            <SearchableSelect
              options={currencyOptions}
              value={form.currency}
              onValueChange={(v) => setForm({ ...form, currency: v })}
              clearable={false}
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
              label={`${PASSENGER_FARE_LABELS[key]} base fare (economy)`}
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
          <FormField label="Duration (hours)" hint="Optional — used for planning">
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
              <span className="text-sm text-muted-foreground">Route is available for booking</span>
            </div>
          </FormField>
        </FormGrid>
        <FormField label="Notes" fullWidth className="mt-4">
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
          />
        </FormField>
      </BilanFormDialog>

      <DetailSheet
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={String(selectedRoute?.route_name || selectedId || "")}
        subtitle={selectedId || undefined}
      >
        {selectedRoute && (
          <DetailSection title="Route">
            <DetailRow label="Origin" value={routeAirportLabel(selectedRoute, "origin")} />
            <DetailRow label="Destination" value={routeAirportLabel(selectedRoute, "destination")} />
            <DetailRow label="Airline" value={String(selectedRoute.airline || "—")} />
            <DetailRow label="Currency" value={String(selectedRoute.currency || "—")} />
            <DetailRow label="Distance (km)" value={String(selectedRoute.distance_km ?? "—")} />
            <DetailRow
              label="Base fares"
              value={formatFaresSummary(
                parseBaseFaresInput(
                  selectedRoute.base_fares,
                  Number(selectedRoute.base_fare) || null,
                ),
                formatMoney,
              )}
            />
            <DetailRow label="Active" value={selectedRoute.is_active ? "Yes" : "No"} />
            <DetailRow label="Notes" value={String(selectedRoute.notes || "")} />
          </DetailSection>
        )}
      </DetailSheet>
    </div>
  );
}
