"use client";

import { useCallback, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/portal/confirm-action-dialog";
import { PortalMasterPageHeader } from "@/components/portal/portal-master-page-header";
import { BilanFormDialog, FormField, FormGrid } from "@/components/portal/form-dialog";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { ListRowActions } from "@/components/portal/list-row-actions";
import {
  RowActionMenuItem,
  RowActionMenuSeparator,
} from "@/components/portal/row-action-menu";
import { ListSearch } from "@/components/portal/list-search";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { getMissingRequired } from "@/lib/validate-form";
import {
  deleteTicketTerms,
  listTicketTerms,
  saveTicketTerms,
} from "@/services/portalMaster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { richTextPreview, richTextToPlain } from "@/lib/rich-text";

const emptyForm = {
  title: "",
  terms_conditions: "",
  default: false,
};

export default function PortalTicketTermsPage() {
  const fetchRows = useCallback(async (search: string) => {
    const res = await listTicketTerms({ limit: 200, search: search.trim() || undefined });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery(fetchRows);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);
  const formAlerts = useFormDialogAlerts();

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
      title: String(row.title || row.name || ""),
      terms_conditions: richTextToPlain(String(row.terms_conditions || "")),
      default: !!row.default,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const missing = getMissingRequired(form, [{ key: "title", label: "Title" }]);
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    formAlerts.clearAlerts();
    try {
      await saveTicketTerms({
        ...(editing?.name ? { name: editing.name } : {}),
        title: form.title.trim(),
        terms_conditions: form.terms_conditions,
        default: form.default ? 1 : 0,
      });
      setOpen(false);
      refresh();
      toast.success(editing ? "Ticket terms updated" : "Ticket terms created");
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save ticket terms");
    }
  };

  const handleDelete = async (name: string) => {
    setDeleteLoading(true);
    try {
      await deleteTicketTerms(name);
      setDeleteConfirmName(null);
      if (selectedId === name) setSelectedId(null);
      refresh();
      toast.success("Ticket terms deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete ticket terms");
    } finally {
      setDeleteLoading(false);
    }
  };

  const selected = rows.find((r) => String(r.name) === selectedId);

  return (
    <div className="space-y-6">
      <PortalMasterPageHeader
        title="Ticket terms"
        description="Master data — terms and conditions shown on tickets (print formats)"
        addLabel="New ticket terms"
        onAdd={openCreate}
        doctype="Ticket Terms"
      />

      <ListSearch value={search} onChange={setSearch} placeholder="Search title..." />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead>Default</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No ticket terms found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={String(r.name)}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(String(r.name))}
                  >
                    <TableCell className="font-medium">{String(r.title || r.name)}</TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {richTextPreview(String(r.terms_conditions || ""))}
                    </TableCell>
                    <TableCell>
                      {r.default ? (
                        <Badge variant="secondary">Default</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ListRowActions doctype="Ticket Terms" docName={String(r.name)}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <RowActionMenuItem icon={Pencil} doctype="Ticket Terms" onClick={() => openEdit(r)}>
                              Edit
                            </RowActionMenuItem>
                            <RowActionMenuSeparator />
                            <RowActionMenuItem
                              icon={Trash2}
                              variant="destructive"
                              disabled={deleteLoading}
                              onClick={() => setDeleteConfirmName(String(r.name))}
                            >
                              Delete
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
        className="sm:max-w-2xl"
        title={editing ? "Edit ticket terms" : "New ticket terms"}
        description="Used on ticket print formats. Mark one record as default for templates that do not specify a set."
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
          <FormField label="Title" required fullWidth>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={!!editing?.name}
            />
          </FormField>
          {editing?.name ? (
            <p className="col-span-full text-xs text-muted-foreground">
              Title is the document ID and cannot be changed after creation. Rename from Desk if
              needed.
            </p>
          ) : null}
          <FormField label="Default for tickets" fullWidth>
            <div className="flex h-9 items-center gap-2">
              <Switch
                checked={form.default}
                onCheckedChange={(checked) => setForm({ ...form, default: checked })}
              />
              <span className="text-sm text-muted-foreground">
                Use when a print format does not select a specific set
              </span>
            </div>
          </FormField>
          <FormField label="Terms & conditions" fullWidth>
            <Textarea
              className="min-h-[240px] font-mono text-sm"
              value={form.terms_conditions}
              onChange={(e) => setForm({ ...form, terms_conditions: e.target.value })}
              placeholder="Enter terms text or HTML..."
            />
          </FormField>
        </FormGrid>
      </BilanFormDialog>

      <DetailSheet
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={String(selected?.title || selectedId)}
        badge={selected?.default ? { label: "Default" } : undefined}
        footer={
          selected ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                className="bg-gold text-navy hover:bg-gold-dark flex-1"
                onClick={() => openEdit(selected)}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={deleteLoading}
                onClick={() => setDeleteConfirmName(String(selected.name))}
                aria-label="Delete ticket terms"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <>
            <DetailSection title="Ticket terms">
              <DetailRow label="Title" value={String(selected.title || selected.name)} />
              <DetailRow label="Default" value={selected.default ? "Yes" : "No"} />
            </DetailSection>
            <DetailSection title="Terms & conditions">
              {selected.terms_conditions ? (
                <p className="whitespace-pre-wrap text-sm">{richTextToPlain(String(selected.terms_conditions))}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No content.</p>
              )}
            </DetailSection>
          </>
        )}
      </DetailSheet>

      <ConfirmActionDialog
        open={!!deleteConfirmName}
        onOpenChange={(open) => !open && setDeleteConfirmName(null)}
        title="Delete ticket terms?"
        description={
          deleteConfirmName ? (
            <>
              <p>
                <span className="font-medium text-foreground">{deleteConfirmName}</span> will be
                permanently removed.
              </p>
              <p>This cannot be undone.</p>
            </>
          ) : null
        }
        confirmLabel="Delete"
        tone="destructive"
        loading={deleteLoading}
        onConfirm={() => {
          if (deleteConfirmName) void handleDelete(deleteConfirmName);
        }}
      />
    </div>
  );
}
