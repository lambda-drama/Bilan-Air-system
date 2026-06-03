"use client";

import { useCallback, useState } from "react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { BilanFormDialog, FormField, FormGrid } from "@/components/portal/form-dialog";
import { ListSearch } from "@/components/portal/list-search";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { getMissingRequired } from "@/lib/validate-form";
import { createBookingAgent, listBookingAgents } from "@/services/portalMaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const emptyForm = {
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  password: "",
};

export default function PortalBookingAgentsPage() {
  const fetchRows = useCallback(async (search: string) => {
    const res = await listBookingAgents({ limit: 200, search: search.trim() || undefined });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery(fetchRows);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const formAlerts = useFormDialogAlerts();

  const handleCreate = async () => {
    const missing = getMissingRequired(form, [
      { key: "email", label: "Email" },
      { key: "first_name", label: "First name" },
      { key: "password", label: "Password" },
    ]);
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    formAlerts.clearAlerts();
    try {
      await createBookingAgent({
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      toast.success("Booking agent created");
      setOpen(false);
      setForm(emptyForm);
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to create agent");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Booking agents</h1>
          <p className="text-muted-foreground">
            System users with the Booking Agent role — portal and desk access for reservations
          </p>
        </div>
        <PortalAddButton
          onClick={() => {
            formAlerts.clearAlerts();
            setForm(emptyForm);
            setOpen(true);
          }}
        >
          New booking agent
        </PortalAddButton>
      </div>

      <ListSearch value={search} onChange={setSearch} placeholder="Search name or email..." />

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
                <TableHead>Phone</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Last login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No booking agents found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((u) => (
                  <TableRow key={String(u.name)}>
                    <TableCell className="font-medium">{String(u.full_name || u.name)}</TableCell>
                    <TableCell>{String(u.email)}</TableCell>
                    <TableCell>{String(u.mobile_no || "—")}</TableCell>
                    <TableCell>{u.enabled ? "Yes" : "No"}</TableCell>
                    <TableCell>{String(u.last_login || "—")}</TableCell>
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
        title="New booking agent"
        description="Creates a Frappe user and assigns the Booking Agent role."
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-gold text-navy hover:bg-gold-dark" onClick={handleCreate}>
              Create user
            </Button>
          </>
        }
      >
        <FormGrid>
          <FormField label="Email" required fullWidth>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label="First name" required>
            <Input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </FormField>
          <FormField label="Last name">
            <Input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </FormField>
          <FormField label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </FormField>
          <FormField label="Password" required fullWidth hint="Initial login password for the agent">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </FormField>
        </FormGrid>
      </BilanFormDialog>
    </div>
  );
}
