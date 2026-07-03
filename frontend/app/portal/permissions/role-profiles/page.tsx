"use client";

import { useCallback, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { PortalMasterPageHeader } from "@/components/portal/portal-master-page-header";
import { BilanFormDialog, FormField } from "@/components/portal/form-dialog";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { ListSearch } from "@/components/portal/list-search";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { RowActionMenuItem } from "@/components/portal/row-action-menu";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import {
  listPermissionRoles,
  listRoleProfilesPortal,
  saveRoleProfilePortal,
  type PermissionRoleRow,
  type RoleProfileRow,
} from "@/services/portalMaster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
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
  role_profile: "",
  roles: [] as string[],
};

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function PortalRoleProfilesPage() {
  const fetchRows = useCallback(async (search: string) => {
    const rows = await listRoleProfilesPortal();
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = `${row.role_profile} ${row.roles.join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, []);
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery<RoleProfileRow>(fetchRows);

  const [roleRows, setRoleRows] = useState<PermissionRoleRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleProfileRow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const formAlerts = useFormDialogAlerts();

  const roleOptions = useMemo(
    () =>
      roleRows.map((row) => ({
        value: row.role_name || row.name,
        label: row.role_name || row.name,
      })),
    [roleRows],
  );

  const selected = useMemo(
    () => rows.find((row) => row.name === selectedId) ?? null,
    [rows, selectedId],
  );

  const loadRoleRows = useCallback(async () => {
    try {
      const next = await listPermissionRoles();
      setRoleRows(next.filter((row) => !row.disabled));
    } catch {
      setRoleRows([]);
    }
  }, []);

  const openCreate = async () => {
    formAlerts.clearAlerts();
    await loadRoleRows();
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = async (row: RoleProfileRow) => {
    formAlerts.clearAlerts();
    await loadRoleRows();
    setEditing(row);
    setForm({
      role_profile: row.role_profile,
      roles: row.roles || [],
    });
    setOpen(true);
  };

  const toggleRole = (roleName: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      roles: checked
        ? [...prev.roles, roleName]
        : prev.roles.filter((role) => role !== roleName),
    }));
  };

  const handleSave = async () => {
    if (!form.role_profile.trim()) {
      formAlerts.showValidation(["Role profile name"]);
      return;
    }
    if (!form.roles.length) {
      formAlerts.showValidation(["At least one role"]);
      return;
    }
    formAlerts.clearAlerts();
    try {
      await saveRoleProfilePortal({
        ...(editing?.name ? { name: editing.name } : {}),
        role_profile: form.role_profile.trim(),
        roles: form.roles,
      });
      setOpen(false);
      refresh();
      toast.success(editing ? "Role profile updated" : "Role profile created");
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save role profile");
    }
  };

  return (
    <div className="space-y-6">
      <PortalMasterPageHeader
        title="Role profiles"
        description="System Manager only. Create reusable permission bundles for portal users."
        addLabel="New role profile"
        onAdd={() => void openCreate()}
        doctype="Role Profile"
      />

      <ListSearch value={search} onChange={setSearch} placeholder="Search role profiles..." />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role profile</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No role profiles found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.name}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(row.name)}
                  >
                    <TableCell className="font-medium">{row.role_profile}</TableCell>
                    <TableCell className="max-w-lg">
                      <div className="flex flex-wrap gap-1">
                        {row.roles.map((role) => (
                          <Badge key={role} variant="secondary">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{row.modified_by || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(row.modified)}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Role profile actions">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <RowActionMenuItem
                            icon={Pencil}
                            doctype="Role Profile"
                            onClick={() => void openEdit(row)}
                          >
                            Edit
                          </RowActionMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        className="sm:max-w-2xl"
        title={editing ? "Edit role profile" : "New role profile"}
        description="Assign one or more allowed roles to this profile."
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
        <div className="space-y-6">
          <FormField label="Role profile name" required fullWidth>
            <Input
              value={form.role_profile}
              onChange={(e) => setForm((prev) => ({ ...prev, role_profile: e.target.value }))}
              disabled={!!editing}
            />
          </FormField>
          {editing ? (
            <p className="text-xs text-muted-foreground">
              Rename role profiles from Desk if needed.
            </p>
          ) : null}
          <FormField label="Quick add role" fullWidth>
            <SearchableSelect
              options={roleOptions}
              value=""
              onValueChange={(value) => {
                if (!value || form.roles.includes(value)) return;
                setForm((prev) => ({ ...prev, roles: [...prev.roles, value] }));
              }}
              placeholder="Search and add a role..."
              clearable={false}
            />
          </FormField>
          <div className="space-y-3">
            <p className="text-sm font-medium">Assigned roles</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {roleOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 rounded-md border px-3 py-2"
                >
                  <Checkbox
                    checked={form.roles.includes(option.value)}
                    onCheckedChange={(checked) => toggleRole(option.value, checked === true)}
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </BilanFormDialog>

      <DetailSheet
        open={!!selected}
        onOpenChange={(next) => !next && setSelectedId(null)}
        title={selected?.role_profile || ""}
      >
        {selected ? (
          <>
            <DetailSection title="Role profile">
              <DetailRow label="Name" value={selected.role_profile} />
              <DetailRow label="Updated by" value={selected.modified_by || "—"} />
              <DetailRow label="Updated on" value={formatDateTime(selected.modified)} />
            </DetailSection>
            <DetailSection title="Roles">
              <div className="flex flex-wrap gap-2">
                {selected.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </div>
            </DetailSection>
          </>
        ) : null}
      </DetailSheet>
    </div>
  );
}
