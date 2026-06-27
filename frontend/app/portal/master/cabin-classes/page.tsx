"use client";

import { useCallback, useState } from "react";
import { MoreHorizontal, Pencil } from "lucide-react";
import { PortalMasterPageHeader } from "@/components/portal/portal-master-page-header";
import { BilanFormDialog, FormField, FormGrid } from "@/components/portal/form-dialog";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { RowActionMenuItem } from "@/components/portal/row-action-menu";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { getMissingRequired } from "@/lib/validate-form";
import { useCurrency } from "@/contexts/currency-context";
import {
  listCabinClasses,
  saveCabinClass,
  type CabinClassRow,
} from "@/services/portalMaster";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  cabin_name: "",
  display_order: "0",
  color_code: "",
  checked_baggage_kg: "",
  checked_baggage_pieces: "1",
  carry_on_kg: "",
  carry_on_pieces: "1",
  excess_baggage_fee_per_kg: "",
  description: "",
  is_active: true,
};

export default function PortalCabinClassesPage() {
  const { formatMoney } = useCurrency();
  const fetchRows = useCallback(async () => listCabinClasses(false), []);
  const { rows, loading, error, refresh } = useLiveListQuery(fetchRows);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CabinClassRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const formAlerts = useFormDialogAlerts();

  const openCreate = () => {
    formAlerts.clearAlerts();
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: CabinClassRow) => {
    formAlerts.clearAlerts();
    setEditing(row);
    setForm({
      cabin_name: String(row.cabin_name || ""),
      display_order: String(row.display_order ?? 0),
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
    const missing = getMissingRequired(form, [{ key: "cabin_name", label: "Cabin name" }]);
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    formAlerts.clearAlerts();
    try {
      await saveCabinClass({
        ...(editing?.name ? { name: editing.name } : {}),
        cabin_name: form.cabin_name.trim(),
        display_order: Number(form.display_order) || 0,
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
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save cabin class");
    }
  };

  const selected = rows.find((r) => String(r.name) === selectedId);

  return (
    <div className="space-y-6">
      <PortalMasterPageHeader
        title="Cabin classes"
        description="Physical cabins (Economy, Business, First) — defaults for search, seat maps, and baggage"
        addLabel="New cabin class"
        onAdd={openCreate}
        doctype="Cabin Class"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cabin</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Checked</TableHead>
              <TableHead>Cabin bag</TableHead>
              <TableHead>Excess / kg</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No cabin classes yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.name}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(String(row.name))}
                >
                  <TableCell className="font-medium">{row.cabin_name}</TableCell>
                  <TableCell>{row.display_order ?? 0}</TableCell>
                  <TableCell>
                    {row.checked_baggage_kg ? `${row.checked_baggage_kg} kg` : "BA default"}
                  </TableCell>
                  <TableCell>
                    {row.carry_on_kg ? `${row.carry_on_kg} kg` : "BA default"}
                  </TableCell>
                  <TableCell>
                    {row.excess_baggage_fee_per_kg
                      ? formatMoney(row.excess_baggage_fee_per_kg)
                      : "BA default"}
                  </TableCell>
                  <TableCell>{row.is_active ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <ListRowActions doctype="Cabin Class" docName={String(row.name)}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <RowActionMenuItem icon={Pencil} doctype="Cabin Class" onClick={() => openEdit(row)}>
                            Edit
                          </RowActionMenuItem>
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
        title={editing ? "Edit cabin class" : "New cabin class"}
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
          <FormField label="Cabin name" required>
            <Input
              placeholder="Economy, Business, First Class"
              value={form.cabin_name}
              onChange={(e) => setForm((f) => ({ ...f, cabin_name: e.target.value }))}
            />
          </FormField>
          <FormField label="Display order">
            <Input
              type="number"
              value={form.display_order}
              onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
            />
          </FormField>
          <FormField label="Color code">
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
          <FormField label="Excess fee per kg">
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
            <div className="flex h-10 items-center">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
              />
            </div>
          </FormField>
        </FormGrid>
      </BilanFormDialog>

      <DetailSheet
        open={!!selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selected?.cabin_name || ""}
        onEdit={selected ? () => openEdit(selected) : undefined}
      >
        {selected ? (
          <DetailSection title="Cabin">
            <DetailRow label="Name" value={selected.cabin_name} />
            <DetailRow label="Display order" value={String(selected.display_order ?? 0)} />
            <DetailRow label="Checked baggage" value={`${selected.checked_baggage_kg || "BA default"} kg`} />
            <DetailRow label="Cabin baggage" value={`${selected.carry_on_kg || "BA default"} kg`} />
            <DetailRow
              label="Excess fee / kg"
              value={
                selected.excess_baggage_fee_per_kg
                  ? formatMoney(selected.excess_baggage_fee_per_kg)
                  : "BA default"
              }
            />
            <DetailRow label="Active" value={selected.is_active ? "Yes" : "No"} />
          </DetailSection>
        ) : null}
      </DetailSheet>
    </div>
  );
}
