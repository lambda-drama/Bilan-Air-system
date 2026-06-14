"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Pencil, UserCheck, UserX } from "lucide-react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { fetchAirportsForPortal } from "@/services/airport";
import { buildAirportSelectOptions, type AirportSelectRow } from "@/lib/airport-select";
import { listCrewMembersPortal, saveCrewMember, setCrewMemberStatus } from "@/services/portalMaster";
import { cn } from "@/lib/utils";
import { listCrewRoles } from "@/services/lookups";
import { BilanFormDialog, FormField, FormGrid } from "@/components/portal/form-dialog";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { RowActionMenuItem } from "@/components/portal/row-action-menu";
import { ListSearch } from "@/components/portal/list-search";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { getMissingRequired } from "@/lib/validate-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";

const STATUS_OPTIONS = ["Active", "On Leave", "Training", "Inactive"];
const ALL_ROLES_VALUE = "all";

function isCrewDeactivated(status: unknown) {
  return String(status || "") === "Inactive";
}

function deactivatedRowClass(inactive: boolean) {
  return inactive
    ? "text-destructive line-through decoration-destructive decoration-2"
    : undefined;
}

const emptyForm = {
  full_name: "",
  crew_role: "",
  employee_id: "",
  license_number: "",
  email: "",
  phone_number: "",
  date_of_hire: "",
  status: "Active",
  base_airport: "",
  max_flight_hours_per_day: "8",
  notes: "",
};

export default function PortalCrewMembersPage() {
  const [roleFilter, setRoleFilter] = useState(ALL_ROLES_VALUE);
  const fetchRows = useCallback(
    async (search: string) => {
      const res = await listCrewMembersPortal({
        limit: 200,
        search: search.trim() || undefined,
        crew_role: roleFilter === ALL_ROLES_VALUE ? undefined : roleFilter,
      });
      return res.data;
    },
    [roleFilter],
  );
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery(fetchRows, {
    reloadKey: roleFilter,
  });
  const [crewRoles, setCrewRoles] = useState<{ name: string; role_name: string; category: string }[]>([]);
  const [airports, setAirports] = useState<AirportSelectRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const formAlerts = useFormDialogAlerts();

  useEffect(() => {
    listCrewRoles().then(setCrewRoles).catch(() => setCrewRoles([]));
    fetchAirportsForPortal()
      .then(setAirports)
      .catch(() => setAirports([]));
  }, []);

  const roleOptions = useMemo(
    () => crewRoles.map((r) => ({ value: r.name, label: r.role_name, description: r.category })),
    [crewRoles],
  );

  const roleLabelByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of crewRoles) map.set(r.name, r.role_name);
    return map;
  }, [crewRoles]);

  const airportOptions = useMemo(() => buildAirportSelectOptions(airports), [airports]);

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
      full_name: String(row.full_name || ""),
      crew_role: String(row.crew_role || ""),
      employee_id: String(row.employee_id || ""),
      license_number: String(row.license_number || ""),
      email: String(row.email || ""),
      phone_number: String(row.phone_number || ""),
      date_of_hire: String(row.date_of_hire || ""),
      status: String(row.status || "Active"),
      base_airport: String(row.base_airport || ""),
      max_flight_hours_per_day: String(row.max_flight_hours_per_day ?? "8"),
      notes: "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const missing = getMissingRequired(form, [
      { key: "full_name", label: "Full name" },
      { key: "crew_role", label: "Crew role" },
      { key: "email", label: "Email" },
      { key: "status", label: "Status" },
    ]);
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    formAlerts.clearAlerts();
    try {
      await saveCrewMember({
        ...(editing?.name ? { name: editing.name } : {}),
        full_name: form.full_name.trim(),
        crew_role: form.crew_role,
        employee_id: form.employee_id.trim() || undefined,
        license_number: form.license_number.trim() || undefined,
        email: form.email.trim(),
        phone_number: form.phone_number.trim() || undefined,
        date_of_hire: form.date_of_hire || undefined,
        status: form.status,
        base_airport: form.base_airport || undefined,
        max_flight_hours_per_day: parseInt(form.max_flight_hours_per_day, 10) || 8,
        notes: form.notes.trim() || undefined,
      });
      toast.success(editing ? "Crew member updated" : "Crew member created");
      setOpen(false);
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save crew member");
    }
  };

  const selected = rows.find((r) => String(r.name) === selectedId);

  const toggleDeactivated = async (row: Record<string, unknown>) => {
    const name = String(row.name);
    const inactive = isCrewDeactivated(row.status);
    try {
      await setCrewMemberStatus(name, inactive ? "Active" : "Inactive");
      toast.success(inactive ? "Crew member reactivated" : "Crew member deactivated");
      if (selectedId === name && inactive) setSelectedId(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Crew members</h1>
          <p className="text-muted-foreground">
            Pilots and cabin crew — records only, not system login users
          </p>
        </div>
        <PortalAddButton onClick={openCreate}>New crew member</PortalAddButton>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ListSearch
          value={search}
          onChange={setSearch}
          placeholder="Search name, email, ID..."
          className="w-full sm:max-w-md"
        />
        <div className="flex flex-col gap-1.5 sm:w-[220px]">
          <label htmlFor="crew-role-filter" className="text-sm font-medium text-muted-foreground">
            Role
          </label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger id="crew-role-filter" className="w-full">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ROLES_VALUE}>All roles</SelectItem>
              {crewRoles.map((r) => (
                <SelectItem key={r.name} value={r.name}>
                  {r.role_name}
                  {r.category ? ` (${r.category})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {search.trim() || roleFilter !== ALL_ROLES_VALUE
                      ? "No crew members match your filters."
                      : "No crew members found."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const inactive = isCrewDeactivated(r.status);
                  const strike = deactivatedRowClass(inactive);
                  return (
                  <TableRow
                    key={String(r.name)}
                    className={cn(
                      "cursor-pointer",
                      inactive && "bg-destructive/5 border-l-2 border-l-destructive",
                    )}
                    onClick={() => setSelectedId(String(r.name))}
                  >
                    <TableCell className={cn("font-medium", strike)}>
                      {String(r.full_name)}
                    </TableCell>
                    <TableCell className={strike}>
                      {roleLabelByName.get(String(r.crew_role)) || String(r.crew_role)}
                    </TableCell>
                    <TableCell className={strike}>{String(r.email)}</TableCell>
                    <TableCell className={cn(inactive && "text-destructive font-medium")}>
                      {String(r.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ListRowActions doctype="Crew Member" docName={String(r.name)}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <RowActionMenuItem icon={Pencil} onClick={() => openEdit(r)}>
                              Edit
                            </RowActionMenuItem>
                            <RowActionMenuItem
                              icon={inactive ? UserCheck : UserX}
                              variant={inactive ? "default" : "destructive"}
                              onClick={() => toggleDeactivated(r)}
                            >
                              {inactive ? "Reactivate" : "Deactivate"}
                            </RowActionMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ListRowActions>
                    </TableCell>
                  </TableRow>
                )})
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <BilanFormDialog
        open={open}
        onOpenChange={setOpen}
        className="sm:max-w-2xl"
        title={editing ? "Edit crew member" : "New crew member"}
        description="Crew records are used for flight scheduling. No login account is created."
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
          <FormField label="Full name" required fullWidth>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </FormField>
          <FormField label="Crew role" required>
            <SearchableSelect
              options={roleOptions}
              value={form.crew_role}
              onValueChange={(v) => setForm({ ...form, crew_role: v })}
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
          <FormField label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label="Phone">
            <Input
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            />
          </FormField>
          <FormField label="Employee ID">
            <Input
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
            />
          </FormField>
          <FormField label="License number">
            <Input
              value={form.license_number}
              onChange={(e) => setForm({ ...form, license_number: e.target.value })}
            />
          </FormField>
          <FormField label="Date of hire">
            <Input
              type="date"
              value={form.date_of_hire}
              onChange={(e) => setForm({ ...form, date_of_hire: e.target.value })}
            />
          </FormField>
          <FormField label="Base airport">
            <SearchableSelect
              options={airportOptions}
              value={form.base_airport}
              onValueChange={(v) => setForm({ ...form, base_airport: v })}
              placeholder="Search airport name or IATA..."
              emptyMessage="No airport found"
            />
          </FormField>
          <FormField label="Max hours / day">
            <Input
              type="number"
              min={1}
              max={24}
              value={form.max_flight_hours_per_day}
              onChange={(e) => setForm({ ...form, max_flight_hours_per_day: e.target.value })}
            />
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
        title={String(selected?.full_name || selectedId)}
        subtitle={String(selected?.crew_role || "")}
        badge={
          selected
            ? {
                label: String(selected.status),
                variant: isCrewDeactivated(selected.status) ? "destructive" : "outline",
              }
            : undefined
        }
        footer={
          selected ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={() => openEdit(selected)}>
                Edit
              </Button>
              <Button
                className={cn(
                  "flex-1",
                  isCrewDeactivated(selected.status)
                    ? "bg-gold text-navy hover:bg-gold-dark"
                    : "bg-red-600 text-white hover:bg-red-500",
                )}
                onClick={() => toggleDeactivated(selected)}
              >
                {isCrewDeactivated(selected.status) ? "Reactivate" : "Deactivate"}
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <DetailSection title="Crew member">
            <div
              className={cn(
                "space-y-0",
                isCrewDeactivated(selected.status) &&
                  "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2",
              )}
            >
              <DetailRow
                label="ID"
                value={String(selected.name)}
                valueClassName={deactivatedRowClass(isCrewDeactivated(selected.status))}
              />
              <DetailRow
                label="Email"
                value={String(selected.email)}
                valueClassName={deactivatedRowClass(isCrewDeactivated(selected.status))}
              />
              <DetailRow label="Phone" value={String(selected.phone_number || "—")} />
              <DetailRow label="Employee ID" value={String(selected.employee_id || "—")} />
              <DetailRow label="License" value={String(selected.license_number || "—")} />
              <DetailRow label="Base airport" value={String(selected.base_airport || "—")} />
              <DetailRow label="Status" value={String(selected.status)} />
            </div>
          </DetailSection>
        )}
      </DetailSheet>
    </div>
  );
}
