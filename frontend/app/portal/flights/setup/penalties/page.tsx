"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Scale, Trash2 } from "lucide-react";
import { BilanFormDialog, FormField, FormGrid } from "@/components/portal/form-dialog";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { RowActionMenu, RowActionMenuItem, RowActionMenuSeparator } from "@/components/portal/row-action-menu";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useCurrency } from "@/contexts/currency-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  saveFlightSetupPenalties,
  type FlightSetupPenaltyRow,
} from "@/services/flightSetup";
import { toast } from "sonner";

const PENALTY_TYPES = ["Cancellation", "Change", "No-show", "Other"];
const APPLIES_WHEN = ["Before departure", "After departure", "Any time"];

const emptyPenalty = (): FlightSetupPenaltyRow => ({
  penalty_type: "Cancellation",
  amount: 0,
  applies_when: "Any time",
  route: "",
  flight_schedule: "",
  description: "",
});

function FlightSetupPenaltiesContent() {
  const searchParams = useSearchParams();
  const flightNumber = decodeURIComponent(searchParams.get("flight_number") || "");
  const { formatMoney } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [routeLabel, setRouteLabel] = useState("");
  const [rows, setRows] = useState<FlightSetupPenaltyRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [form, setForm] = useState<FlightSetupPenaltyRow>(emptyPenalty());
  const [saving, setSaving] = useState(false);
  const formAlerts = useFormDialogAlerts();

  const load = async () => {
    if (!flightNumber) return;
    setLoading(true);
    try {
      const setup = await getFlightSetup(flightNumber);
      if (!setup.has_master) {
        toast.error("Save flight setup first before adding penalties.");
        return;
      }
      setRouteLabel(
        setup.origin_label && setup.destination_label
          ? `${setup.origin_label} → ${setup.destination_label}`
          : setup.route_label || setup.route,
      );
      setRows(setup.flight_penalties || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load penalties");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightNumber]);

  const openCreate = () => {
    formAlerts.clearAlerts();
    setEditIndex(null);
    setForm(emptyPenalty());
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
      await saveFlightSetupPenalties(flightNumber, next);
      setRows(next);
      toast.success("Penalty removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveRow = async () => {
    if (!form.penalty_type || !form.amount) {
      formAlerts.showValidation(["Penalty type", "Amount"]);
      return;
    }
    formAlerts.clearAlerts();
    const next = [...rows];
    const payload = {
      ...form,
      amount: parseFloat(String(form.amount)) || 0,
      route: form.route || undefined,
      flight_schedule: form.flight_schedule || undefined,
    };
    if (editIndex != null) next[editIndex] = payload;
    else next.push(payload);

    setSaving(true);
    try {
      const saved = await saveFlightSetupPenalties(flightNumber, next);
      setRows(saved.flight_penalties || next);
      setDialogOpen(false);
      toast.success(editIndex != null ? "Penalty updated" : "Penalty added");
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="mt-1 text-2xl font-bold">Flight penalties</h1>
          <p className="text-muted-foreground">{routeLabel || "Cancellation, change, and no-show fees"}</p>
        </div>
        <PortalAddButton onClick={openCreate} doctype="Flight Setup" permission="write" disabled={loading || saving}>
          Add penalty
        </PortalAddButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-gold" />
            Penalty rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">No penalties configured for this flight yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Applies when</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={`${row.penalty_type}-${idx}`}>
                    <TableCell>{row.penalty_type}</TableCell>
                    <TableCell>{formatMoney(row.amount)}</TableCell>
                    <TableCell>{row.applies_when || "Any time"}</TableCell>
                    <TableCell>
                      {row.flight_schedule
                        ? `Schedule ${row.flight_schedule}`
                        : row.route
                          ? `Route ${row.route}`
                          : "All departures"}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActionMenu>
                        <RowActionMenuItem icon={Pencil} doctype="Flight Setup" onClick={() => openEdit(idx)}>
                          Edit penalty
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
          )}
        </CardContent>
      </Card>

      <BilanFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        className="sm:max-w-2xl"
        title={editIndex != null ? "Edit penalty" : "Add penalty"}
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
              Save penalty
            </Button>
          </>
        }
      >
        <FormGrid>
          <FormField label="Penalty type" required>
            <SearchableSelect
              value={form.penalty_type}
              onValueChange={(v) => setForm({ ...form, penalty_type: v })}
              options={PENALTY_TYPES.map((p) => ({ value: p, label: p }))}
              clearable={false}
            />
          </FormField>
          <FormField label="Amount" required>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label="Applies when">
            <SearchableSelect
              value={form.applies_when || "Any time"}
              onValueChange={(v) => setForm({ ...form, applies_when: v })}
              options={APPLIES_WHEN.map((p) => ({ value: p, label: p }))}
              clearable={false}
            />
          </FormField>
          <FormField label="Route (optional)" fullWidth hint="Leave empty for all routes on this flight">
            <Input
              value={form.route || ""}
              onChange={(e) => setForm({ ...form, route: e.target.value })}
              placeholder="Flight Route name"
            />
          </FormField>
          <FormField label="Flight schedule (optional)" fullWidth>
            <Input
              value={form.flight_schedule || ""}
              onChange={(e) => setForm({ ...form, flight_schedule: e.target.value })}
              placeholder="Specific departure ID"
            />
          </FormField>
          <FormField label="Description" fullWidth>
            <Textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </FormField>
        </FormGrid>
      </BilanFormDialog>
    </div>
  );
}

export default function FlightSetupPenaltiesPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <FlightSetupPenaltiesContent />
    </Suspense>
  );
}
