"use client";

import { useCallback, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { PortalMasterPageHeader } from "@/components/portal/portal-master-page-header";
import { BilanFormDialog, FormField, FormGrid } from "@/components/portal/form-dialog";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { ListSearch } from "@/components/portal/list-search";
import { RowActionMenuItem } from "@/components/portal/row-action-menu";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import {
  listPermissionRoles,
  savePermissionRole,
  type PermissionRoleRow,
} from "@/services/portalMaster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  role_name: "",
  desk_access: true,
  disabled: false,
  two_factor_auth: false,
};

export default function PortalRolesPage() {
  const fetchRows = useCallback(async (search: string) => {
    const rows = await listPermissionRoles();
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.role_name || row.name}`.toLowerCase().includes(q));
  }, []);
  const { search, setSearch, rows, loading, error, refresh } =
    useLiveListQuery<PermissionRoleRow>(fetchRows);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PermissionRoleRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const formAlerts = useFormDialogAlerts();

  const selected = useMemo(
    () => rows.find((row) => String(row.name) === selectedId) ?? null,
    [rows, selectedId],
  );

  const openEdit = (row: PermissionRoleRow) => {
    formAlerts.clearAlerts();
    setEditing(row);
    setForm({
      role_name: row.role_name || row.name,
      desk_access: row.desk_access === 1 || row.desk_access === true,
      disabled: row.disabled === 1 || row.disabled === true,
      two_factor_auth: false,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    formAlerts.clearAlerts();
    try {
      await savePermissionRole({
        role_name: form.role_name,
        desk_access: form.desk_access ? 1 : 0,
        disabled: form.disabled ? 1 : 0,
        two_factor_auth: form.two_factor_auth ? 1 : 0,
      });
      setOpen(false);
      refresh();
      toast.success("Role updated");
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save role");
    }
  };

  return (
    <div className="space-y-6">
      <PortalMasterPageHeader
        title="Roles"
        description="System Manager only. Manage the allowed operational roles used by portal users."
        addLabel="New role"
        onAdd={() => setOpen(true)}
        doctype="Role"
      />

      <ListSearch value={search} onChange={setSearch} placeholder="Search roles..." />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Disabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    No roles found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.name}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(row.name)}
                  >
                    <TableCell className="font-medium">{row.role_name || row.name}</TableCell>
                    <TableCell>
                      {row.disabled ? <Badge variant="destructive">Disabled</Badge> : "No"}
                    </TableCell>
                    <TableCell className="text-right">
                      <ListRowActions doctype="Role" docName={row.name}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Role actions">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <RowActionMenuItem icon={Pencil} doctype="Role" onClick={() => openEdit(row)}>
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
      )}

      <BilanFormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit role" : "New role"}
        description="Only the approved operational roles are shown here."
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
          <FormField label="Role name" required fullWidth>
            <input
              className="h-9 w-full rounded-md border bg-muted/40 px-3 text-sm"
              value={form.role_name}
              disabled
              readOnly
            />
          </FormField>
          <FormField label="Disabled" fullWidth>
            <div className="flex h-9 items-center gap-2">
              <Switch
                checked={form.disabled}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, disabled: checked }))}
              />
              <span className="text-sm text-muted-foreground">Remove the role from active use</span>
            </div>
          </FormField>
        </FormGrid>
      </BilanFormDialog>

      <DetailSheet
        open={!!selected}
        onOpenChange={(next) => !next && setSelectedId(null)}
        title={selected?.role_name || selected?.name || ""}
      >
        {selected ? (
          <DetailSection title="Role">
            <DetailRow label="Role name" value={selected.role_name || selected.name} />
            <DetailRow label="Disabled" value={selected.disabled ? "Yes" : "No"} />
          </DetailSection>
        ) : null}
      </DetailSheet>
    </div>
  );
}
