"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { fetchAllRoutes, saveRoute } from "@/services/flightRoute";
import { fetchAllAirports } from "@/services/airport";
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
import { DocLink } from "@/components/portal/doc-link";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { ListSearch } from "@/components/portal/list-search";
import { useClientListFilter } from "@/hooks/use-client-list-filter";
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

const ROUTE_SEARCH_KEYS = [
  "name",
  "route_name",
  "origin_airport",
  "destination_airport",
] as const;

export default function PortalRoutesPage() {
  const { formatMoney } = useCurrency();
  const [routes, setRoutes] = useState<Record<string, unknown>[]>([]);
  const { search, setSearch, filtered: filteredRoutes } = useClientListFilter(
    routes,
    [...ROUTE_SEARCH_KEYS],
  );
  const [airports, setAirports] = useState<{ name: string; iata_code: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const emptyRouteForm = {
    origin_airport: "",
    destination_airport: "",
    distance_km: "",
    base_fare: "",
    is_active: true,
    notes: "",
  };
  const [form, setForm] = useState(emptyRouteForm);
  const formAlerts = useFormDialogAlerts();

  const handleDialogOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      formAlerts.clearAlerts();
      setForm(emptyRouteForm);
    }
  };

  const load = () => {
    fetchAllRoutes().then(setRoutes);
    fetchAllAirports().then(setAirports);
  };

  useEffect(() => {
    load();
  }, []);

  const selectedRoute = routes.find((r) => String(r.name) === selectedId);

  const airportOptions = useMemo(
    () =>
      airports.map((a) => ({
        value: a.name,
        label: `${a.iata_code} — ${a.name}`,
        description: a.iata_code,
      })),
    [airports],
  );

  const handleCreate = async () => {
    const missing = getMissingRequired(form, [
      { key: "origin_airport", label: "Origin airport" },
      { key: "destination_airport", label: "Destination airport" },
      { key: "distance_km", label: "Distance (km)" },
      { key: "base_fare", label: "Base fare" },
    ]);
    const extra: string[] = [...missing];
    const distanceKm = parseFloat(form.distance_km);
    const baseFare = parseFloat(form.base_fare);
    if (!distanceKm || distanceKm <= 0) extra.push("Distance (km) must be greater than zero");
    if (!baseFare || baseFare <= 0) extra.push("Base fare must be greater than zero");

    if (extra.length) {
      formAlerts.showValidation(extra);
      return;
    }

    formAlerts.clearAlerts();
    try {
      await saveRoute({
        origin_airport: form.origin_airport,
        destination_airport: form.destination_airport,
        distance_km: distanceKm,
        base_fare: baseFare,
        is_active: form.is_active ? 1 : 0,
        notes: form.notes || undefined,
      });
      setOpen(false);
      setForm(emptyRouteForm);
      formAlerts.clearAlerts();
      load();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save route");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Flight routes</h2>
        <PortalAddButton
          onClick={() => {
            formAlerts.clearAlerts();
            setOpen(true);
          }}
        >
          New route
        </PortalAddButton>
      </div>

      <ListSearch
        value={search}
        onChange={setSearch}
        placeholder="Search route, origin, destination..."
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Distance (km)</TableHead>
              <TableHead>Base fare</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRoutes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {search.trim() ? "No routes match your search." : "No routes yet."}
                </TableCell>
              </TableRow>
            ) : (
            filteredRoutes.map((r) => (
              <TableRow
                key={String(r.name)}
                className="cursor-pointer"
                onClick={() => setSelectedId(String(r.name))}
              >
                <TableCell>
                  <DocLink onClick={() => setSelectedId(String(r.name))}>
                    {String(r.name)}
                  </DocLink>
                </TableCell>
                <TableCell>{String(r.route_name || r.name)}</TableCell>
                <TableCell>{String(r.origin_airport)}</TableCell>
                <TableCell>{String(r.destination_airport)}</TableCell>
                <TableCell>{String(r.distance_km ?? "—")}</TableCell>
                <TableCell>{formatMoney(r.base_fare as number)}</TableCell>
                <TableCell className="text-right">
                  <ListRowActions doctype="Flight Route" docName={String(r.name)}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedId(String(r.name))}>
                          View details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ListRowActions>
                </TableCell>
              </TableRow>
            )))}
          </TableBody>
        </Table>
      </div>

      <BilanFormDialog
        open={open}
        onOpenChange={handleDialogOpenChange}
        className="sm:max-w-2xl"
        title="New route"
        description="Route name and flight series are generated automatically."
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-gold text-navy hover:bg-gold-dark" onClick={handleCreate}>
              Create
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
              emptyMessage="No airport found"
              clearable={false}
            />
          </FormField>
          <FormField label="Destination airport" required>
            <SearchableSelect
              options={airportOptions}
              value={form.destination_airport}
              onValueChange={(v) => setForm({ ...form, destination_airport: v })}
              placeholder="Search airport..."
              emptyMessage="No airport found"
              clearable={false}
            />
          </FormField>
          <FormField label="Distance (km)" required>
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 1200"
              value={form.distance_km}
              onChange={(e) => setForm({ ...form, distance_km: e.target.value })}
            />
          </FormField>
          <FormField label="Base fare (adult, economy)" required>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.base_fare}
              onChange={(e) => setForm({ ...form, base_fare: e.target.value })}
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
            <DetailRow label="ID" value={String(selectedRoute.name)} />
            <DetailRow label="Origin" value={String(selectedRoute.origin_airport)} />
            <DetailRow label="Destination" value={String(selectedRoute.destination_airport)} />
            <DetailRow label="Distance (km)" value={String(selectedRoute.distance_km ?? "—")} />
            <DetailRow label="Base fare" value={formatMoney(selectedRoute.base_fare as number)} />
            <DetailRow label="Active" value={selectedRoute.is_active ? "Yes" : "No"} />
            <DetailRow label="Notes" value={String(selectedRoute.notes || "")} />
          </DetailSection>
        )}
      </DetailSheet>
    </div>
  );
}
