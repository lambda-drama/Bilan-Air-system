"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { PortalMasterPageHeader } from "@/components/portal/portal-master-page-header";
import {
  getAirplane,
  listAirlines,
  listAirplanes,
  listSeatClasses,
  saveAirplane,
} from "@/services/portalMaster";
import { BilanFormDialog, FormField, FormGrid, FormSection } from "@/components/portal/form-dialog";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { ListSearch } from "@/components/portal/list-search";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { getMissingRequired } from "@/lib/validate-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_OPTIONS = ["Active", "Maintenance", "Retired"];
const COLUMN_OPTIONS = [
  "A,B,C,D,E,F",
  "A,B,C,D,E,F,G",
  "A,B,C,D,E,F,G,H",
  "A,B,C,D,E,F,G,H,J",
];

type SeatRow = {
  seat_class: string;
  rows: string;
  columns_per_row: string;
  start_row_number: string;
};

const emptySeatRow = (): SeatRow => ({
  seat_class: "",
  rows: "",
  columns_per_row: COLUMN_OPTIONS[0],
  start_row_number: "1",
});

const emptyForm = {
  registration_number: "",
  airline: "",
  aircraft_model: "",
  status: "Active",
  seat_config: [emptySeatRow()] as SeatRow[],
};

export default function PortalAirplanesPage() {
  const fetchRows = useCallback(async (search: string) => {
    const res = await listAirplanes({ limit: 200, search: search.trim() || undefined });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery(fetchRows);
  const [airlines, setAirlines] = useState<{ name: string; airline_name: string }[]>([]);
  const [seatClasses, setSeatClasses] = useState<{ name: string; class_name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<SeatRow[]>([]);
  const formAlerts = useFormDialogAlerts();

  useEffect(() => {
    listAirlines({ limit: 200 }).then((r) =>
      setAirlines(r.data as { name: string; airline_name: string }[]),
    );
    listSeatClasses().then(setSeatClasses).catch(() => setSeatClasses([]));
  }, []);

  const airlineOptions = useMemo(
    () => airlines.map((a) => ({ value: a.name, label: a.airline_name || a.name })),
    [airlines],
  );

  const seatClassOptions = useMemo(
    () => seatClasses.map((s) => ({ value: s.name, label: s.class_name || s.name })),
    [seatClasses],
  );

  const openCreate = () => {
    formAlerts.clearAlerts();
    setEditingName(null);
    setForm({ ...emptyForm, seat_config: [emptySeatRow()] });
    setOpen(true);
  };

  const openEdit = async (name: string) => {
    formAlerts.clearAlerts();
    try {
      const doc = await getAirplane(name);
      setEditingName(name);
      setForm({
        registration_number: String(doc.registration_number || ""),
        airline: String(doc.airline || ""),
        aircraft_model: String(doc.aircraft_model || ""),
        status: String(doc.status || "Active"),
        seat_config: (doc.seat_config || []).length
          ? (doc.seat_config as Record<string, unknown>[]).map((r) => ({
              seat_class: String(r.seat_class || ""),
              rows: String(r.rows ?? ""),
              columns_per_row: String(r.columns_per_row || COLUMN_OPTIONS[0]),
              start_row_number: String(r.start_row_number ?? "1"),
            }))
          : [emptySeatRow()],
      });
      setOpen(true);
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Could not load airplane");
    }
  };

  const handleSave = async () => {
    const missing = getMissingRequired(form, [
      { key: "registration_number", label: "Registration number" },
      { key: "airline", label: "Airline" },
      { key: "aircraft_model", label: "Aircraft model" },
      { key: "status", label: "Status" },
    ]);
    const extra = [...missing];
    if (!form.seat_config.length) extra.push("At least one seat configuration row is required");
    for (let i = 0; i < form.seat_config.length; i++) {
      const row = form.seat_config[i];
      if (!row.seat_class) extra.push(`Seat class on row ${i + 1}`);
      if (!row.rows || parseInt(row.rows, 10) <= 0) extra.push(`Rows on row ${i + 1}`);
    }
    if (extra.length) {
      formAlerts.showValidation(extra);
      return;
    }

    formAlerts.clearAlerts();
    try {
      await saveAirplane({
        ...(editingName ? { name: editingName } : {}),
        registration_number: form.registration_number.trim(),
        airline: form.airline,
        aircraft_model: form.aircraft_model.trim(),
        status: form.status,
        seat_config: form.seat_config.map((r) => ({
          seat_class: r.seat_class,
          rows: parseInt(r.rows, 10),
          columns_per_row: r.columns_per_row,
          start_row_number: parseInt(r.start_row_number, 10) || 1,
        })),
      });
      setOpen(false);
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save airplane");
    }
  };

  const selected = rows.find((r) => String(r.name) === selectedId);

  useEffect(() => {
    if (!selectedId) {
      setDetailRows([]);
      return;
    }
    getAirplane(selectedId)
      .then((doc) => {
        setDetailRows(
          ((doc.seat_config || []) as Record<string, unknown>[]).map((r) => ({
            seat_class: String(r.seat_class || ""),
            rows: String(r.rows ?? ""),
            columns_per_row: String(r.columns_per_row || ""),
            start_row_number: String(r.start_row_number ?? ""),
          })),
        );
      })
      .catch(() => setDetailRows([]));
  }, [selectedId]);

  return (
    <div className="space-y-6">
      <PortalMasterPageHeader
        title="Airplanes"
        description="Master data — fleet registration and seat layout"
        addLabel="New airplane"
        onAdd={openCreate}
      />

      <ListSearch value={search} onChange={setSearch} placeholder="Search registration, model..." />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registration</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Airline</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No airplanes found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={String(r.name)}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(String(r.name))}
                  >
                    <TableCell className="font-medium">{String(r.registration_number)}</TableCell>
                    <TableCell>{String(r.aircraft_model)}</TableCell>
                    <TableCell>{String(r.airline)}</TableCell>
                    <TableCell>{String(r.total_seats ?? "—")}</TableCell>
                    <TableCell>{String(r.status)}</TableCell>
                    <TableCell className="text-right">
                      <ListRowActions doctype="Airplane" docName={String(r.name)}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(String(r.name))}>
                              Edit
                            </DropdownMenuItem>
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
        title={editingName ? "Edit airplane" : "New airplane"}
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
          <FormField label="Registration number" required>
            <Input
              value={form.registration_number}
              onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
            />
          </FormField>
          <FormField label="Aircraft model" required>
            <Input
              value={form.aircraft_model}
              onChange={(e) => setForm({ ...form, aircraft_model: e.target.value })}
            />
          </FormField>
          <FormField label="Airline" required>
            <SearchableSelect
              options={airlineOptions}
              value={form.airline}
              onValueChange={(v) => setForm({ ...form, airline: v })}
              clearable={false}
            />
          </FormField>
          <FormField label="Status" required>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormGrid>

        <FormSection title="Seat configuration" className="mt-4">
          <div className="space-y-3">
            {form.seat_config.map((row, idx) => (
              <div key={idx} className="grid gap-3 rounded-md border p-3 sm:grid-cols-4">
                <FormField label="Seat class" required className="sm:col-span-1">
                  <SearchableSelect
                    options={seatClassOptions}
                    value={row.seat_class}
                    onValueChange={(v) => {
                      const next = [...form.seat_config];
                      next[idx] = { ...next[idx], seat_class: v };
                      setForm({ ...form, seat_config: next });
                    }}
                    clearable={false}
                  />
                </FormField>
                <FormField label="Rows" required>
                  <Input
                    type="number"
                    min={1}
                    value={row.rows}
                    onChange={(e) => {
                      const next = [...form.seat_config];
                      next[idx] = { ...next[idx], rows: e.target.value };
                      setForm({ ...form, seat_config: next });
                    }}
                  />
                </FormField>
                <FormField label="Columns" required>
                  <Select
                    value={row.columns_per_row}
                    onValueChange={(v) => {
                      const next = [...form.seat_config];
                      next[idx] = { ...next[idx], columns_per_row: v };
                      setForm({ ...form, seat_config: next });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMN_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Start row">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={row.start_row_number}
                      onChange={(e) => {
                        const next = [...form.seat_config];
                        next[idx] = { ...next[idx], start_row_number: e.target.value };
                        setForm({ ...form, seat_config: next });
                      }}
                    />
                    {form.seat_config.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setForm({
                            ...form,
                            seat_config: form.seat_config.filter((_, i) => i !== idx),
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </FormField>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setForm({ ...form, seat_config: [...form.seat_config, emptySeatRow()] })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add cabin
            </Button>
          </div>
        </FormSection>
      </BilanFormDialog>

      <DetailSheet
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={String(selected?.registration_number || selectedId)}
        subtitle={String(selected?.aircraft_model || "")}
      >
        {selected && (
          <>
            <DetailSection title="Aircraft">
              <DetailRow label="Airline" value={String(selected.airline)} />
              <DetailRow label="Total seats" value={String(selected.total_seats ?? "—")} />
              <DetailRow label="Status" value={String(selected.status)} />
            </DetailSection>
            {detailRows.length > 0 && (
              <DetailSection title="Seat layout">
                {detailRows.map((r, i) => (
                  <DetailRow
                    key={i}
                    label={r.seat_class}
                    value={`${r.rows} rows × ${r.columns_per_row} (from row ${r.start_row_number})`}
                  />
                ))}
              </DetailSection>
            )}
          </>
        )}
      </DetailSheet>
    </div>
  );
}
