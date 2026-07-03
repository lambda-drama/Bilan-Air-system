"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Pencil, UserCheck, UserX } from "lucide-react";

import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { BilanFormDialog, FormField, FormGrid } from "@/components/portal/form-dialog";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { RowActionMenuItem } from "@/components/portal/row-action-menu";
import { ListSearch } from "@/components/portal/list-search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { cn } from "@/lib/utils";
import { getMissingRequired } from "@/lib/validate-form";
import {
  createStaffUser,
  listRoleProfileOptions,
  listStaffUsersPortal,
  saveStaffUser,
  type StaffUserRow,
} from "@/services/portalMaster";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "1", label: "Active" },
  { value: "0", label: "Inactive" },
];

const emptyForm = {
  full_name: "",
  email: "",
  mobile_no: "",
  role_profile_name: "",
  enabled: "1",
  password: "",
  confirm_password: "",
};

function isInactive(row: Pick<StaffUserRow, "enabled"> | null | undefined) {
  return !(row?.enabled === 1 || row?.enabled === true);
}

function strikeClass(inactive: boolean) {
  return inactive
    ? "text-destructive line-through decoration-destructive decoration-2"
    : undefined;
}

function formatLastLogin(value: string | null | undefined) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function PortalStaffUsersPage() {
  const fetchRows = useCallback(async (search: string) => {
    const res = await listStaffUsersPortal({
      limit: 200,
      search: search.trim() || undefined,
    });
    return res.data;
  }, []);

  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery(fetchRows);
  const [roleProfiles, setRoleProfiles] = useState<Array<{ name: string; role_profile: string }>>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUserRow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const formAlerts = useFormDialogAlerts();

  useEffect(() => {
    listRoleProfileOptions()
      .then((rows) => {
        setRoleProfiles(rows);
        setForm((current) => ({
          ...current,
          role_profile_name: current.role_profile_name || rows[0]?.name || "",
        }));
      })
      .catch(() => setRoleProfiles([]));
  }, []);

  const roleProfileOptions = useMemo(
    () =>
      roleProfiles.map((row) => ({
        value: row.name,
        label: row.role_profile || row.name,
      })),
    [roleProfiles],
  );

  const roleProfileLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of roleProfiles) {
      map.set(row.name, row.role_profile || row.name);
    }
    return map;
  }, [roleProfiles]);

  const openCreate = () => {
    formAlerts.clearAlerts();
    setEditing(null);
    setForm({
      ...emptyForm,
      role_profile_name: roleProfiles[0]?.name || "",
    });
    setOpen(true);
  };

  const openEdit = (row: StaffUserRow) => {
    formAlerts.clearAlerts();
    setEditing(row);
    setForm({
      full_name: String(row.full_name || ""),
      email: String(row.email || ""),
      mobile_no: String(row.mobile_no || ""),
      role_profile_name: String(row.role_profile_name || roleProfiles[0]?.name || ""),
      enabled: row.enabled === 1 || row.enabled === true ? "1" : "0",
      password: "",
      confirm_password: "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const required = [
      { key: "full_name", label: "Full name" },
      { key: "role_profile_name", label: "Role profile" },
    ];
    if (!editing) {
      required.push(
        { key: "email", label: "Email" },
        { key: "password", label: "Password" },
        { key: "confirm_password", label: "Confirm password" },
      );
    }
    const missing = getMissingRequired(form, required);
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    if (!editing && form.password !== form.confirm_password) {
      formAlerts.setSubmitError("Passwords do not match");
      return;
    }

    formAlerts.clearAlerts();
    try {
      if (editing) {
        await saveStaffUser({
          name: editing.name,
          full_name: form.full_name.trim(),
          mobile_no: form.mobile_no.trim() || undefined,
          role_profile_name: form.role_profile_name,
          enabled: form.enabled === "1" ? 1 : 0,
        });
        toast.success("Staff user updated");
      } else {
        await createStaffUser({
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          mobile_no: form.mobile_no.trim() || undefined,
          role_profile_name: form.role_profile_name,
          password: form.password,
          enabled: form.enabled === "1" ? 1 : 0,
        });
        toast.success("Staff user created");
      }
      setOpen(false);
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save staff user");
    }
  };

  const toggleEnabled = async (row: StaffUserRow) => {
    const inactive = isInactive(row);
    try {
      await saveStaffUser({
        name: row.name,
        full_name: row.full_name,
        mobile_no: row.mobile_no || undefined,
        role_profile_name: row.role_profile_name || roleProfiles[0]?.name || "",
        enabled: inactive ? 1 : 0,
      });
      toast.success(inactive ? "Staff user activated" : "Staff user deactivated");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update staff user");
    }
  };

  const selected = rows.find((row) => row.name === selectedId) || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-muted-foreground">
            Simple system login users that are not booking agents or crew members
          </p>
        </div>
        <PortalAddButton onClick={openCreate} doctype="User">
          New staff user
        </PortalAddButton>
      </div>

      <ListSearch
        value={search}
        onChange={setSearch}
        placeholder="Search name, email, phone, role profile..."
        className="w-full sm:max-w-md"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role profile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {search.trim() ? "No staff users match your search." : "No staff users found."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const inactive = isInactive(row);
                  const strike = strikeClass(inactive);
                  return (
                    <TableRow
                      key={row.name}
                      className={cn(
                        "cursor-pointer",
                        inactive && "border-l-2 border-l-destructive bg-destructive/5",
                      )}
                      onClick={() => setSelectedId(row.name)}
                    >
                      <TableCell className={cn("font-medium", strike)}>{row.full_name}</TableCell>
                      <TableCell className={strike}>{row.email}</TableCell>
                      <TableCell className={strike}>
                        {roleProfileLabel.get(String(row.role_profile_name || "")) ||
                          row.role_profile_name ||
                          "—"}
                      </TableCell>
                      <TableCell className={cn(inactive && "font-medium text-destructive")}>
                        {inactive ? "Inactive" : "Active"}
                      </TableCell>
                      <TableCell className={strike}>{formatLastLogin(row.last_login)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <RowActionMenuItem icon={Pencil} doctype="User" onClick={() => openEdit(row)}>
                                Edit
                              </RowActionMenuItem>
                              <RowActionMenuItem
                                icon={inactive ? UserCheck : UserX}
                                variant={inactive ? "default" : "destructive"}
                                onClick={() => toggleEnabled(row)}
                              >
                                {inactive ? "Activate" : "Deactivate"}
                              </RowActionMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <BilanFormDialog
        open={open}
        onOpenChange={setOpen}
        className="sm:max-w-2xl"
        title={editing ? "Edit staff user" : "New staff user"}
        description="Creates a plain system user only. No booking agent or crew profile is created."
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
          <FormField label="Full name" required>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </FormField>
          <FormField label="Role profile" required>
            <Select
              value={form.role_profile_name}
              onValueChange={(value) => setForm({ ...form, role_profile_name: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role profile" />
              </SelectTrigger>
              <SelectContent>
                {roleProfileOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Email" required>
            <Input
              type="email"
              value={form.email}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label="Phone">
            <Input
              value={form.mobile_no}
              onChange={(e) => setForm({ ...form, mobile_no: e.target.value })}
            />
          </FormField>
          <FormField label="Status" required>
            <Select value={form.enabled} onValueChange={(value) => setForm({ ...form, enabled: value })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {!editing ? (
            <>
              <FormField label="Password" required>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </FormField>
              <FormField label="Confirm password" required>
                <Input
                  type="password"
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                />
              </FormField>
            </>
          ) : null}
        </FormGrid>
      </BilanFormDialog>

      <DetailSheet
        open={!!selectedId}
        onOpenChange={(nextOpen) => !nextOpen && setSelectedId(null)}
        title={selected?.full_name || selectedId || "Staff user"}
        subtitle={selected?.email || ""}
        badge={
          selected
            ? {
                label: isInactive(selected) ? "Inactive" : "Active",
                variant: isInactive(selected) ? "destructive" : "outline",
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
                  isInactive(selected)
                    ? "bg-gold text-navy hover:bg-gold-dark"
                    : "bg-red-600 text-white hover:bg-red-500",
                )}
                onClick={() => toggleEnabled(selected)}
              >
                {isInactive(selected) ? "Activate" : "Deactivate"}
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected ? (
          <DetailSection title="Staff user">
            <div
              className={cn(
                "space-y-0",
                isInactive(selected) &&
                  "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2",
              )}
            >
              <DetailRow label="User ID" value={selected.name} valueClassName={strikeClass(isInactive(selected))} />
              <DetailRow label="Email" value={selected.email} valueClassName={strikeClass(isInactive(selected))} />
              <DetailRow label="Phone" value={selected.mobile_no || "—"} />
              <DetailRow
                label="Role profile"
                value={
                  roleProfileLabel.get(String(selected.role_profile_name || "")) ||
                  selected.role_profile_name ||
                  "—"
                }
              />
              <DetailRow label="Last login" value={formatLastLogin(selected.last_login)} />
            </div>
          </DetailSection>
        ) : null}
      </DetailSheet>
    </div>
  );
}
