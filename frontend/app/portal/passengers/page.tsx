"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { listPassengers, registerPassenger, type PassengerRecord } from "@/services/passenger";
import { ListSearch } from "@/components/portal/list-search";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import {
  BilanFormDialog,
  FormField,
  FormGrid,
} from "@/components/portal/form-dialog";
import { listCountries } from "@/services/lookups";
import { getMissingRequired } from "@/lib/validate-form";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { DocLink } from "@/components/portal/doc-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableSelect } from "@/components/portal/searchable-select";

const PASSENGER_TYPE_OPTIONS = [
  { value: "Adult", label: "Adult" },
  { value: "Child", label: "Child" },
  { value: "Infant", label: "Infant" },
];

export default function PortalPassengersPage() {
  const fetchPassengers = useCallback(async (search: string) => {
    const res = await listPassengers({ search: search.trim() || undefined, limit: 100 });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, refresh } = useLiveListQuery<PassengerRecord>(
    fetchPassengers,
  );
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const emptyForm = {
    full_name: "",
    passenger_type: "Adult",
    id_number: "",
    date_of_birth: "",
    phone_number: "",
    email: "",
    nationality: "",
    notes: "",
    is_active: true,
  };
  const [form, setForm] = useState(emptyForm);
  const [countries, setCountries] = useState<{ name: string }[]>([]);
  const formAlerts = useFormDialogAlerts();

  const handleDialogOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      formAlerts.clearAlerts();
      setForm(emptyForm);
    }
  };

  useEffect(() => {
    if (!open) return;
    listCountries().then(setCountries).catch(() => setCountries([]));
  }, [open]);

  const selectedRow = rows.find((p) => p.name === selectedId);

  const handleCreate = async () => {
    const missing = getMissingRequired(
      { ...form, is_active: 1 },
      [
        { key: "full_name", label: "Full name" },
        { key: "passenger_type", label: "Passenger type" },
        { key: "date_of_birth", label: "Date of birth" },
        { key: "phone_number", label: "Phone number" },
        { key: "email", label: "Email" },
      ],
    );
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }

    formAlerts.clearAlerts();
    try {
      await registerPassenger({
        ...form,
        is_active: form.is_active ? 1 : 0,
      });
      setOpen(false);
      setForm(emptyForm);
      formAlerts.clearAlerts();
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(
        e instanceof Error ? e.message : "Failed to register passenger",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Passengers</h2>
        <PortalAddButton
          onClick={() => {
            formAlerts.clearAlerts();
            setOpen(true);
          }}
        >
          New passenger
        </PortalAddButton>
      </div>

      <ListSearch
        value={search}
        onChange={setSearch}
        placeholder="Search name, ID, phone, email..."
      />

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>ID number</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {search.trim() ? "No passengers match your search." : "No passengers yet."}
                </TableCell>
              </TableRow>
            ) : (
            rows.map((p) => (
              <TableRow
                key={p.name}
                className="cursor-pointer"
                onClick={() => setSelectedId(p.name)}
              >
                <TableCell>
                  <DocLink onClick={() => setSelectedId(p.name)}>{p.name}</DocLink>
                </TableCell>
                <TableCell>{p.full_name}</TableCell>
                <TableCell>{p.id_number}</TableCell>
                <TableCell>{p.phone_number}</TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell>{p.passenger_type}</TableCell>
              </TableRow>
            )))}
          </TableBody>
        </Table>
      </div>
      )}

      <BilanFormDialog
        open={open}
        onOpenChange={handleDialogOpenChange}
        className="sm:max-w-2xl"
        title="Register passenger"
        description="All required Passenger fields from the booking system."
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-gold text-navy hover:bg-gold-dark" onClick={handleCreate}>
              Save
            </Button>
          </>
        }
      >
        <FormGrid>
          <FormField label="Full name" required fullWidth>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </FormField>
          <FormField label="Passenger type" required>
            <SearchableSelect
              options={PASSENGER_TYPE_OPTIONS}
              value={form.passenger_type}
              onValueChange={(v) => setForm({ ...form, passenger_type: v })}
              placeholder="Search type..."
              clearable={false}
            />
          </FormField>
          <FormField label="ID number (passport or national ID)">
            <Input
              value={form.id_number}
              onChange={(e) => setForm({ ...form, id_number: e.target.value })}
            />
          </FormField>
          <FormField label="Date of birth" required>
            <Input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
          </FormField>
          <FormField label="Phone number" required>
            <Input
              type="tel"
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            />
          </FormField>
          <FormField label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label="Nationality">
            <SearchableSelect
              options={countries.map((c) => ({ value: c.name, label: c.name }))}
              value={form.nationality}
              onValueChange={(v) => setForm({ ...form, nationality: v })}
              placeholder="Search country..."
              emptyMessage="No country found"
            />
          </FormField>
          <FormField label="Active" fullWidth>
            <div className="flex h-9 items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <span className="text-sm text-muted-foreground">Passenger profile is active</span>
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
        title={selectedRow?.full_name || selectedId || ""}
        subtitle={selectedId || undefined}
        badge={selectedRow ? { label: selectedRow.passenger_type } : undefined}
      >
        {selectedRow && (
          <DetailSection title="Passenger">
            <DetailRow label="ID" value={selectedRow.name} />
            <DetailRow label="ID number" value={selectedRow.id_number} />
            <DetailRow label="Date of birth" value={selectedRow.date_of_birth} />
            <DetailRow label="Phone" value={selectedRow.phone_number} />
            <DetailRow label="Email" value={selectedRow.email} />
            <DetailRow label="Nationality" value={selectedRow.nationality} />
            <DetailRow label="Active" value={selectedRow.is_active !== 0 ? "Yes" : "No"} />
            <DetailRow label="Notes" value={selectedRow.notes} />
          </DetailSection>
        )}
      </DetailSheet>
    </div>
  );
}
