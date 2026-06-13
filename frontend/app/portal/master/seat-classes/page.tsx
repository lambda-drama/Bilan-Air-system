"use client";

import { useCallback, useEffect, useState } from "react";
import { MoreHorizontal, Pencil } from "lucide-react";
import { PortalMasterPageHeader } from "@/components/portal/portal-master-page-header";
import { BilanFormDialog, FormField, FormGrid } from "@/components/portal/form-dialog";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { getMissingRequired } from "@/lib/validate-form";
import { useCurrency } from "@/contexts/currency-context";
import { listSeatClasses, listCabinClasses, saveSeatClass, type CabinClassRow, type SeatClassRow } from "@/services/portalMaster";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const emptyForm = {
  class_name: "",
  cabin_class: "",
  use_on_aircraft_layout: false,
  price_multiplier: "1",
  color_code: "",
  checked_baggage_kg: "",
  checked_baggage_pieces: "1",
  carry_on_kg: "",
  carry_on_pieces: "1",
  excess_baggage_fee_per_kg: "",
  description: "",
  is_active: true,
};

export default function PortalSeatClassesPage() {
  const { formatMoney } = useCurrency();
  const fetchRows = useCallback(async () => listSeatClasses(false), []);
  const { rows, loading, error, refresh } = useLiveListQuery(fetchRows);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SeatClassRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const formAlerts = useFormDialogAlerts();
  const [cabins, setCabins] = useState<CabinClassRow[]>([]);

  useEffect(() => {
    listCabinClasses(false).then(setCabins).catch(() => setCabins([]));
  }, []);

  const cabinLabel = (link?: string) =>
    cabins.find((c) => c.name === link)?.cabin_name || link || "—";

  const openCreate = () => {
    formAlerts.clearAlerts();
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: SeatClassRow) => {
    formAlerts.clearAlerts();
    setEditing(row);
    setForm({
      class_name: String(row.class_name || ""),
      cabin_class: String(row.cabin_class || ""),
      use_on_aircraft_layout: !!row.use_on_aircraft_layout,
      price_multiplier: String(row.price_multiplier ?? 1),
      color_code: String(row.color_code || ""),
      checked_baggage_kg: row.checked_baggage_kg ? String(row.checked_baggage_kg) : "",
      checked_baggage_pieces: String(row.checked_baggage_pieces ?? 1),
      carry_on_kg: row.carry_on_kg ? String(row.carry_on_kg) : "",
      carry_on_pieces: String(row.carry_on_pieces ?? 1),
      excess_baggage_fee_per_kg: row.excess_baggage_fee_per_kg
        ? String(row.excess_baggage_fee_per_kg)
        : "",
      description: String(row.description || ""),
      is_active: !!row.is_active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const missing = getMissingRequired(form, [
      { key: "class_name", label: "Fare class code" },
      { key: "cabin_class", label: "Cabin class" },
    ]);
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    formAlerts.clearAlerts();
    try {
      await saveSeatClass({
        ...(editing?.name ? { name: editing.name } : {}),
        class_name: form.class_name.trim(),
        cabin_class: form.cabin_class,
        use_on_aircraft_layout: form.use_on_aircraft_layout ? 1 : 0,
        price_multiplier: Number(form.price_multiplier) || 1,
        color_code: form.color_code.trim() || undefined,
        checked_baggage_kg: form.checked_baggage_kg ? Number(form.checked_baggage_kg) : 0,
        checked_baggage_pieces: Number(form.checked_baggage_pieces) || 1,
        carry_on_kg: form.carry_on_kg ? Number(form.carry_on_kg) : 0,
        carry_on_pieces: Number(form.carry_on_pieces) || 1,
        excess_baggage_fee_per_kg: form.excess_baggage_fee_per_kg
          ? Number(form.excess_baggage_fee_per_kg)
          : 0,
        description: form.description.trim() || undefined,
        is_active: form.is_active ? 1 : 0,
      });
      setOpen(false);
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save seat class");
    }
  };

  const selected = rows.find((r) => String(r.name) === selectedId);

  return (
    <div className="space-y-6">
      <PortalMasterPageHeader
        title="Fare classes"
        description="Booking fare codes (L, M, Y…) linked to a cabin — multipliers and baggage overrides"
        addLabel="New fare class"
        onAdd={openCreate}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fare code</TableHead>
              <TableHead>Cabin</TableHead>
              <TableHead>Layout</TableHead>
              <TableHead>Multiplier</TableHead>
              <TableHead>Checked</TableHead>
              <TableHead>Excess / kg</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  No seat classes yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.name}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(String(row.name))}
                >
                  <TableCell className="font-medium">{row.class_name}</TableCell>
                  <TableCell>{cabinLabel(row.cabin_class)}</TableCell>
                  <TableCell>{row.use_on_aircraft_layout ? "Yes" : "No"}</TableCell>
                  <TableCell>{row.price_multiplier ?? 1}</TableCell>
                  <TableCell>
                    {row.checked_baggage_kg ? `${row.checked_baggage_kg} kg` : "Cabin / BA default"}
                    {row.checked_baggage_pieces ? ` · ${row.checked_baggage_pieces} pc` : ""}
                  </TableCell>
                  <TableCell>
                    {row.excess_baggage_fee_per_kg
                      ? formatMoney(row.excess_baggage_fee_per_kg)
                      : "Cabin / BA default"}
                  </TableCell>
                  <TableCell>{row.is_active ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <ListRowActions doctype="Seat Class" docName={String(row.name)}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(row)}>Edit</DropdownMenuItem>
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

      <BilanFormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit fare class" : "New fare class"}
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
          <FormField label="Fare class code" required>
            <Input
              placeholder="e.g. L, M, Y"
              value={form.class_name}
              onChange={(e) => setForm((f) => ({ ...f, class_name: e.target.value }))}
            />
          </FormField>
          <FormField label="Cabin class" required>
            <SearchableSelect
              options={cabins.map((c) => ({ value: c.name, label: c.cabin_name }))}
              value={form.cabin_class}
              onValueChange={(v) => setForm((f) => ({ ...f, cabin_class: v }))}
              clearable={false}
            />
          </FormField>
          <FormField label="Use on aircraft layout">
            <div className="flex h-10 items-center">
              <Switch
                checked={form.use_on_aircraft_layout}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, use_on_aircraft_layout: checked }))
                }
              />
            </div>
          </FormField>
          <FormField label="Price multiplier" required>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={form.price_multiplier}
              onChange={(e) => setForm((f) => ({ ...f, price_multiplier: e.target.value }))}
            />
          </FormField>
          <FormField label="Seat map color">
            <Input
              placeholder="#FFD700"
              value={form.color_code}
              onChange={(e) => setForm((f) => ({ ...f, color_code: e.target.value }))}
            />
          </FormField>
          <FormField label="Checked baggage (kg)">
            <Input
              type="number"
              min={0}
              step={0.1}
              placeholder="Use BA Settings default"
              value={form.checked_baggage_kg}
              onChange={(e) => setForm((f) => ({ ...f, checked_baggage_kg: e.target.value }))}
            />
          </FormField>
          <FormField label="Checked bags (pieces)">
            <Input
              type="number"
              min={1}
              value={form.checked_baggage_pieces}
              onChange={(e) => setForm((f) => ({ ...f, checked_baggage_pieces: e.target.value }))}
            />
          </FormField>
          <FormField label="Cabin baggage (kg)">
            <Input
              type="number"
              min={0}
              step={0.1}
              placeholder="Use BA Settings default"
              value={form.carry_on_kg}
              onChange={(e) => setForm((f) => ({ ...f, carry_on_kg: e.target.value }))}
            />
          </FormField>
          <FormField label="Cabin bags (pieces)">
            <Input
              type="number"
              min={1}
              value={form.carry_on_pieces}
              onChange={(e) => setForm((f) => ({ ...f, carry_on_pieces: e.target.value }))}
            />
          </FormField>
          <FormField label="Excess baggage fee (per kg)">
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="Use BA Settings default"
              value={form.excess_baggage_fee_per_kg}
              onChange={(e) =>
                setForm((f) => ({ ...f, excess_baggage_fee_per_kg: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Description" className="sm:col-span-2">
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </FormField>
          <FormField label="Active">
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
            />
          </FormField>
        </FormGrid>
      </BilanFormDialog>

      <DetailSheet
        open={!!selected}
        onOpenChange={(v) => !v && setSelectedId(null)}
        title={selected?.class_name || ""}
        footer={
          selected ? (
            <Button
              className="w-full bg-gold text-navy hover:bg-gold-dark"
              onClick={() => {
                openEdit(selected);
                setSelectedId(null);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit seat class
            </Button>
          ) : null
        }
      >
        {selected && (
          <>
            <DetailSection title="Fare">
              <DetailRow label="Multiplier" value={String(selected.price_multiplier ?? 1)} />
              <DetailRow label="Color" value={selected.color_code || "—"} />
              <DetailRow label="Active" value={selected.is_active ? "Yes" : "No"} />
            </DetailSection>
            <DetailSection title="Baggage allowance">
              <DetailRow
                label="Checked"
                value={
                  selected.checked_baggage_kg
                    ? `${selected.checked_baggage_kg} kg · ${selected.checked_baggage_pieces ?? 1} bag(s)`
                    : "BA Settings default"
                }
              />
              <DetailRow
                label="Cabin"
                value={
                  selected.carry_on_kg
                    ? `${selected.carry_on_kg} kg · ${selected.carry_on_pieces ?? 1} bag(s)`
                    : "BA Settings default"
                }
              />
              <DetailRow
                label="Excess fee per kg"
                value={
                  selected.excess_baggage_fee_per_kg
                    ? formatMoney(selected.excess_baggage_fee_per_kg)
                    : "BA Settings default"
                }
              />
            </DetailSection>
            {selected.description ? (
              <DetailSection title="Notes">
                <DetailRow label="Description" value={selected.description} />
              </DetailSection>
            ) : null}
          </>
        )}
      </DetailSheet>
    </div>
  );
}
