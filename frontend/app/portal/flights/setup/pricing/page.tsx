"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DollarSign, Pencil, Trash2 } from "lucide-react";
import { BilanFormDialog, FormField, FormGrid, FormSection } from "@/components/portal/form-dialog";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { RowActionMenu, RowActionMenuItem, RowActionMenuSeparator } from "@/components/portal/row-action-menu";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useCurrency } from "@/contexts/currency-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  flightSetupPath,
  getFlightSetup,
  listSeatClassOptions,
  saveFlightSetupPrices,
  type FlightSetupPriceRow,
} from "@/services/flightSetup";
import { formatFareClassLabel } from "@/lib/fare-class-display";
import { toast } from "sonner";

const PASSENGER_TYPES = ["Adult", "Child", "Infant"];

const emptyPriceRow = (): FlightSetupPriceRow => ({
  seat_class: "",
  passenger_type: "Adult",
  tax_group_name: "",
  surcharge_group_name: "",
  fare: 0,
  non_base_agent_commission: 0,
  base_agent_commission: 0,
  baggage_pieces: 1,
  baggage_weight_kg: 30,
  hand_carry_pieces: 1,
  hand_carry_weight_kg: 5,
});

function FlightSetupPricingContent() {
  const searchParams = useSearchParams();
  const flightNumber = decodeURIComponent(searchParams.get("flight_number") || "");
  const { formatMoney } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [routeLabel, setRouteLabel] = useState("");
  const [rows, setRows] = useState<FlightSetupPriceRow[]>([]);
  const [seatClasses, setSeatClasses] = useState<Array<{ value: string; label: string }>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [form, setForm] = useState<FlightSetupPriceRow>(emptyPriceRow());
  const [saving, setSaving] = useState(false);
  const formAlerts = useFormDialogAlerts();

  const [seatClassesLoading, setSeatClassesLoading] = useState(false);

  const loadSeatClassOptions = async () => {
    setSeatClassesLoading(true);
    try {
      const seatClassList = await listSeatClassOptions();
      const list = Array.isArray(seatClassList) ? seatClassList : [];
      setSeatClasses(
        list.map((sc) => ({
          value: sc.name,
          label:
            sc.label ||
            formatFareClassLabel(sc.class_name || sc.name, sc.cabin_name),
        })),
      );
    } catch (e) {
      setSeatClasses([]);
      toast.error(e instanceof Error ? e.message : "Failed to load fare classes");
    } finally {
      setSeatClassesLoading(false);
    }
  };

  const load = async () => {
    if (!flightNumber) return;
    setLoading(true);
    try {
      const setup = await getFlightSetup(flightNumber);
      if (!setup.has_master) {
        toast.error("Save flight setup first before adding pricing.");
      }
      setRouteLabel(
        setup.origin_label && setup.destination_label
          ? `${setup.origin_label} → ${setup.destination_label}`
          : setup.route_label || setup.route,
      );
      setRows(setup.flight_prices || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load pricing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSeatClassOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightNumber]);

  const openCreate = () => {
    formAlerts.clearAlerts();
    setEditIndex(null);
    setForm(emptyPriceRow());
    setDialogOpen(true);
  };

  const openEdit = (index: number) => {
    formAlerts.clearAlerts();
    setEditIndex(index);
    setForm({ ...rows[index] });
    setDialogOpen(true);
  };

  const removeRow = async (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    setSaving(true);
    try {
      await saveFlightSetupPrices(flightNumber, next);
      setRows(next);
      toast.success("Price removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveRow = async () => {
    if (!form.seat_class || !form.fare) {
      formAlerts.showValidation(["Fare class", "Fare"]);
      return;
    }
    formAlerts.clearAlerts();
    const next = [...rows];
    const payload = {
      ...form,
      fare: parseFloat(String(form.fare)) || 0,
      non_base_agent_commission: parseFloat(String(form.non_base_agent_commission)) || 0,
      base_agent_commission: parseFloat(String(form.base_agent_commission)) || 0,
      baggage_pieces: parseInt(String(form.baggage_pieces), 10) || 0,
      baggage_weight_kg: parseInt(String(form.baggage_weight_kg), 10) || 0,
      hand_carry_pieces: parseInt(String(form.hand_carry_pieces), 10) || 0,
      hand_carry_weight_kg: parseInt(String(form.hand_carry_weight_kg), 10) || 0,
    };
    if (editIndex != null) next[editIndex] = payload;
    else next.push(payload);

    setSaving(true);
    try {
      const saved = await saveFlightSetupPrices(flightNumber, next);
      setRows(saved.flight_prices || next);
      setDialogOpen(false);
      toast.success(editIndex != null ? "Price updated" : "Price added");
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const seatLabel = (name: string) =>
    seatClasses.find((s) => s.value === name)?.label || name;

  if (!flightNumber) {
    return (
      <p className="text-muted-foreground">
        Missing flight number.{" "}
        <Link href="/portal/flights/setup" className="text-gold hover:underline">
          Back to flight setup
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={flightSetupPath(flightNumber)} className="text-sm text-gold hover:underline">
            ← {flightNumber}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Flight pricing</h1>
          <p className="text-muted-foreground">{routeLabel || "Per fare class and passenger type"}</p>
        </div>
        <PortalAddButton onClick={openCreate} disabled={loading || saving}>
          Add price
        </PortalAddButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-gold" />
            Price list
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">
              No flight-level prices yet. These apply before route or schedule pricing.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fare class</TableHead>
                    <TableHead>Passenger</TableHead>
                    <TableHead>Fare</TableHead>
                    <TableHead>Tax group</TableHead>
                    <TableHead>Surcharge</TableHead>
                    <TableHead>Baggage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={`${row.seat_class}-${row.passenger_type}-${idx}`}>
                      <TableCell>{seatLabel(row.seat_class)}</TableCell>
                      <TableCell>{row.passenger_type}</TableCell>
                      <TableCell>{formatMoney(row.fare)}</TableCell>
                      <TableCell>{row.tax_group_name || "—"}</TableCell>
                      <TableCell>{row.surcharge_group_name || "—"}</TableCell>
                      <TableCell>
                        {row.baggage_pieces ?? 0} × {row.baggage_weight_kg ?? 0} kg
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActionMenu>
                          <RowActionMenuItem icon={Pencil} onClick={() => openEdit(idx)}>
                            Edit price
                          </RowActionMenuItem>
                          <RowActionMenuSeparator />
                          <RowActionMenuItem
                            icon={Trash2}
                            variant="destructive"
                            onClick={() => void removeRow(idx)}
                          >
                            Delete
                          </RowActionMenuItem>
                        </RowActionMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <BilanFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        className="sm:max-w-3xl"
        title={editIndex != null ? "Edit flight price" : "Add flight price"}
        description={routeLabel ? `Flight ${flightNumber} · ${routeLabel}` : undefined}
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold-dark"
              onClick={() => void saveRow()}
              disabled={saving}
            >
              Save price
            </Button>
          </>
        }
      >
        <FormGrid>
          <FormField label="Fare class" required fullWidth>
            <SearchableSelect
              value={form.seat_class}
              onValueChange={(v) => setForm({ ...form, seat_class: v })}
              options={seatClasses}
              placeholder="Select fare class"
              emptyMessage={
                seatClassesLoading
                  ? "Loading fare classes..."
                  : "No active fare classes found — add them under Master → Fare classes"
              }
              isLoading={seatClassesLoading}
              clearable={false}
            />
          </FormField>
          <FormField label="Passenger type" required>
            <SearchableSelect
              value={form.passenger_type}
              onValueChange={(v) => setForm({ ...form, passenger_type: v })}
              options={PASSENGER_TYPES.map((p) => ({ value: p, label: p }))}
              clearable={false}
            />
          </FormField>
          <FormField label="Fare" required>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.fare}
              onChange={(e) => setForm({ ...form, fare: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label="Tax group name">
            <Input
              value={form.tax_group_name || ""}
              onChange={(e) => setForm({ ...form, tax_group_name: e.target.value })}
            />
          </FormField>
          <FormField label="Surcharge group name">
            <Input
              value={form.surcharge_group_name || ""}
              onChange={(e) => setForm({ ...form, surcharge_group_name: e.target.value })}
            />
          </FormField>
          <FormField label="Non base agent commission">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.non_base_agent_commission ?? 0}
              onChange={(e) =>
                setForm({ ...form, non_base_agent_commission: parseFloat(e.target.value) || 0 })
              }
            />
          </FormField>
          <FormField label="Base agent commission">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.base_agent_commission ?? 0}
              onChange={(e) =>
                setForm({ ...form, base_agent_commission: parseFloat(e.target.value) || 0 })
              }
            />
          </FormField>
        </FormGrid>
        <FormSection title="Baggage & hand carry" className="mt-6">
          <FormGrid>
            <FormField label="Baggage pieces">
              <Input
                type="number"
                min={0}
                value={form.baggage_pieces ?? 0}
                onChange={(e) =>
                  setForm({ ...form, baggage_pieces: parseInt(e.target.value, 10) || 0 })
                }
              />
            </FormField>
            <FormField label="Baggage weight (kg)">
              <Input
                type="number"
                min={0}
                value={form.baggage_weight_kg ?? 0}
                onChange={(e) =>
                  setForm({ ...form, baggage_weight_kg: parseInt(e.target.value, 10) || 0 })
                }
              />
            </FormField>
            <FormField label="Hand carry pieces">
              <Input
                type="number"
                min={0}
                value={form.hand_carry_pieces ?? 0}
                onChange={(e) =>
                  setForm({ ...form, hand_carry_pieces: parseInt(e.target.value, 10) || 0 })
                }
              />
            </FormField>
            <FormField label="Hand carry weight (kg)">
              <Input
                type="number"
                min={0}
                value={form.hand_carry_weight_kg ?? 0}
                onChange={(e) =>
                  setForm({ ...form, hand_carry_weight_kg: parseInt(e.target.value, 10) || 0 })
                }
              />
            </FormField>
          </FormGrid>
        </FormSection>
      </BilanFormDialog>
    </div>
  );
}

export default function FlightSetupPricingPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <FlightSetupPricingContent />
    </Suspense>
  );
}
