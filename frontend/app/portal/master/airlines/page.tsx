"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { PortalMasterPageHeader } from "@/components/portal/portal-master-page-header";
import { BilanFormDialog, FormField, FormGrid } from "@/components/portal/form-dialog";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { ListSearch } from "@/components/portal/list-search";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { getMissingRequired } from "@/lib/validate-form";
import { listAirlines, saveAirline } from "@/services/portalMaster";
import { listCountries } from "@/services/lookups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

const emptyForm = {
  airline_name: "",
  iata_code: "",
  icao_code: "",
  country: "",
  is_active: true,
};

export default function PortalAirlinesPage() {
  const fetchRows = useCallback(async (search: string) => {
    const res = await listAirlines({ limit: 200, search: search.trim() || undefined });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery(fetchRows);
  const [countries, setCountries] = useState<{ name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const formAlerts = useFormDialogAlerts();

  useEffect(() => {
    listCountries().then(setCountries).catch(() => setCountries([]));
  }, []);

  const countryOptions = useMemo(
    () => countries.map((c) => ({ value: c.name, label: c.name })),
    [countries],
  );

  const openCreate = () => {
    formAlerts.clearAlerts();
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    formAlerts.clearAlerts();
    setEditing(row);
    setForm({
      airline_name: String(row.airline_name || ""),
      iata_code: String(row.iata_code || ""),
      icao_code: String(row.icao_code || ""),
      country: String(row.country || ""),
      is_active: !!row.is_active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const missing = getMissingRequired(form, [
      { key: "airline_name", label: "Airline name" },
      { key: "iata_code", label: "IATA code" },
      { key: "country", label: "Country" },
    ]);
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    formAlerts.clearAlerts();
    try {
      await saveAirline({
        ...(editing?.name ? { name: editing.name } : {}),
        airline_name: form.airline_name.trim(),
        iata_code: form.iata_code.trim().toUpperCase(),
        icao_code: form.icao_code.trim().toUpperCase() || undefined,
        country: form.country,
        is_active: form.is_active ? 1 : 0,
      });
      setOpen(false);
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save airline");
    }
  };

  const selected = rows.find((r) => String(r.name) === selectedId);

  return (
    <div className="space-y-6">
      <PortalMasterPageHeader
        title="Airlines"
        description="Master data — carriers for routes and aircraft"
        addLabel="New airline"
        onAdd={openCreate}
      />

      <ListSearch value={search} onChange={setSearch} placeholder="Search name, IATA, ICAO..." />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IATA</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>ICAO</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No airlines found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={String(r.name)}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(String(r.name))}
                  >
                    <TableCell className="font-medium">{String(r.iata_code)}</TableCell>
                    <TableCell>{String(r.airline_name)}</TableCell>
                    <TableCell>{String(r.icao_code || "—")}</TableCell>
                    <TableCell>{String(r.country)}</TableCell>
                    <TableCell>{r.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <ListRowActions doctype="Airline" docName={String(r.name)}>
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
        title={editing ? "Edit airline" : "New airline"}
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
          <FormField label="Airline name" required fullWidth>
            <Input
              value={form.airline_name}
              onChange={(e) => setForm({ ...form, airline_name: e.target.value })}
            />
          </FormField>
          <FormField label="IATA code" required>
            <Input
              maxLength={3}
              value={form.iata_code}
              onChange={(e) => setForm({ ...form, iata_code: e.target.value.toUpperCase() })}
            />
          </FormField>
          <FormField label="ICAO code">
            <Input
              maxLength={3}
              value={form.icao_code}
              onChange={(e) => setForm({ ...form, icao_code: e.target.value.toUpperCase() })}
            />
          </FormField>
          <FormField label="Country" required>
            <SearchableSelect
              options={countryOptions}
              value={form.country}
              onValueChange={(v) => setForm({ ...form, country: v })}
              placeholder="Select country..."
              clearable={false}
            />
          </FormField>
          <FormField label="Active" fullWidth>
            <div className="flex h-9 items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <span className="text-sm text-muted-foreground">Airline is active</span>
            </div>
          </FormField>
        </FormGrid>
      </BilanFormDialog>

      <DetailSheet
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={String(selected?.airline_name || selectedId)}
        subtitle={selectedId || undefined}
      >
        {selected && (
          <DetailSection title="Airline">
            <DetailRow label="IATA" value={String(selected.iata_code)} />
            <DetailRow label="ICAO" value={String(selected.icao_code || "—")} />
            <DetailRow label="Country" value={String(selected.country)} />
            <DetailRow label="Active" value={selected.is_active ? "Yes" : "No"} />
          </DetailSection>
        )}
      </DetailSheet>
    </div>
  );
}
