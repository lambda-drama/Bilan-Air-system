"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { BilanFormDialog, FormField, FormGrid } from "@/components/portal/form-dialog";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { ListSearch } from "@/components/portal/list-search";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { getMissingRequired } from "@/lib/validate-form";
import {
  createBookingAgent,
  getBookingAgentDefaults,
  listBookingAgents,
} from "@/services/portalMaster";
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
  agent_name: "",
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  address_line1: "",
  address_line2: "",
  phone: "",
  phone_2: "",
  city: "",
  password: "",
  confirmation_mode: "Credit Agent" as "Credit Agent" | "Booking Only",
  credit_limit: "",
};

export default function PortalBookingAgentsPage() {
  const fetchRows = useCallback(async (search: string) => {
    const res = await listBookingAgents({ limit: 200, search: search.trim() || undefined });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery(fetchRows);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const formAlerts = useFormDialogAlerts();

  useEffect(() => {
    if (!open) return;
    getBookingAgentDefaults()
      .then((defaults) => {
        setForm((prev) => ({
          ...prev,
          confirmation_mode:
            (defaults.confirmation_mode as "Credit Agent" | "Booking Only") || "Credit Agent",
          credit_limit:
            defaults.credit_limit != null ? String(defaults.credit_limit) : prev.credit_limit,
        }));
        setCitySuggestions(defaults.cities ?? []);
      })
      .catch(() => {});
  }, [open]);

  const selected = useMemo(
    () => rows.find((r) => String(r.name) === selectedUser) ?? null,
    [rows, selectedUser],
  );

  const handleCreate = async () => {
    const missing = getMissingRequired(form, [
      { key: "agent_name", label: "Company name" },
      { key: "username", label: "Username" },
      { key: "email", label: "Email" },
      { key: "first_name", label: "First name" },
      { key: "last_name", label: "Last name" },
      { key: "address_line1", label: "Address 1" },
      { key: "phone", label: "Phone 1" },
      { key: "city", label: "City" },
      { key: "password", label: "Password" },
    ]);
    if (form.confirmation_mode === "Credit Agent" && !form.credit_limit.trim()) {
      missing.push("Credit limit");
    }
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    formAlerts.clearAlerts();
    try {
      await createBookingAgent({
        agent_name: form.agent_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        address_line1: form.address_line1.trim(),
        address_line2: form.address_line2.trim() || undefined,
        city: form.city.trim(),
        phone: form.phone.trim(),
        phone_2: form.phone_2.trim() || undefined,
        password: form.password,
        confirmation_mode: form.confirmation_mode,
        credit_limit:
          form.confirmation_mode === "Credit Agent"
            ? parseFloat(form.credit_limit) || 0
            : 0,
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
            Portal users with agency address, credit limit, and confirmation mode
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

      <ListSearch
        value={search}
        onChange={setSearch}
        placeholder="Search company, username, email, city, address..."
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    No booking agents found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((u) => (
                  <TableRow
                    key={String(u.name)}
                    className="cursor-pointer"
                    onClick={() => setSelectedUser(String(u.name))}
                  >
                    <TableCell className="font-medium">
                      {String(u.agent_name || u.full_name || u.name)}
                    </TableCell>
                    <TableCell>{String(u.username || "—")}</TableCell>
                    <TableCell>{String(u.email)}</TableCell>
                    <TableCell>{String(u.city || "—")}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {String(u.address_line1 || "—")}
                    </TableCell>
                    <TableCell>{String(u.phone || u.mobile_no || "—")}</TableCell>
                    <TableCell>{String(u.confirmation_mode || "—")}</TableCell>
                    <TableCell>
                      {u.confirmation_mode === "Credit Agent"
                        ? String(u.credit_available ?? u.credit_limit ?? 0)
                        : "—"}
                    </TableCell>
                    <TableCell>{u.enabled ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <DetailSheet
        open={!!selected}
        onOpenChange={(open) => !open && setSelectedUser(null)}
        title={String(selected?.agent_name || selected?.full_name || "Booking agent")}
        description={String(selected?.email || "")}
      >
        {selected && (
          <>
            <DetailSection title="User information">
              <DetailRow label="Company name" value={String(selected.agent_name || "—")} />
              <DetailRow label="Username" value={String(selected.username || "—")} />
              <DetailRow label="Email" value={String(selected.email || "—")} />
              <DetailRow
                label="Name"
                value={
                  [selected.first_name, selected.last_name].filter(Boolean).join(" ") ||
                  String(selected.full_name || "—")
                }
              />
              <DetailRow label="Phone 1" value={String(selected.phone || selected.mobile_no || "—")} />
              <DetailRow label="Phone 2" value={String(selected.phone_2 || "—")} />
            </DetailSection>
            <DetailSection title="Address">
              <DetailRow label="Address 1" value={String(selected.address_line1 || "—")} />
              <DetailRow label="Address 2" value={String(selected.address_line2 || "—")} />
              <DetailRow label="City" value={String(selected.city || "—")} />
            </DetailSection>
            <DetailSection title="Credit & access">
              <DetailRow label="Confirmation mode" value={String(selected.confirmation_mode || "—")} />
              <DetailRow
                label="Credit limit"
                value={
                  selected.confirmation_mode === "Credit Agent"
                    ? String(selected.credit_limit ?? 0)
                    : "N/A"
                }
              />
              <DetailRow label="Credit used" value={String(selected.credit_used ?? 0)} />
              <DetailRow label="Credit available" value={String(selected.credit_available ?? 0)} />
              <DetailRow label="Portal enabled" value={selected.enabled ? "Yes" : "No"} />
            </DetailSection>
          </>
        )}
      </DetailSheet>

      <BilanFormDialog
        open={open}
        onOpenChange={setOpen}
        className="sm:max-w-2xl"
        title="New booking agent"
        description="Creates a portal user, ERPNext address, and booking agent profile."
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-gold text-navy hover:bg-gold-dark" onClick={handleCreate}>
              Create agent
            </Button>
          </>
        }
      >
        <FormGrid>
          <FormField label="Company name" required fullWidth>
            <Input
              value={form.agent_name}
              onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
            />
          </FormField>
          <FormField label="Username" required>
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </FormField>
          <FormField label="Email" required>
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
          <FormField label="Last name" required>
            <Input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </FormField>
          <FormField label="Address 1" required fullWidth>
            <Textarea
              value={form.address_line1}
              onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
              rows={2}
            />
          </FormField>
          <FormField label="Address 2" fullWidth>
            <Textarea
              value={form.address_line2}
              onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
              rows={2}
            />
          </FormField>
          <FormField label="Phone 1" required>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </FormField>
          <FormField label="Phone 2">
            <Input
              value={form.phone_2}
              onChange={(e) => setForm({ ...form, phone_2: e.target.value })}
            />
          </FormField>
          <FormField label="City" required fullWidth>
            <Input
              list="booking-agent-cities"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="e.g. Nairobi"
            />
            <datalist id="booking-agent-cities">
              {citySuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </FormField>
          <FormField label="Confirmation mode" required fullWidth>
            <Select
              value={form.confirmation_mode}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  confirmation_mode: v as "Credit Agent" | "Booking Only",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Credit Agent">
                  Credit agent (PNR on credit until limit)
                </SelectItem>
                <SelectItem value="Booking Only">
                  Booking only (must pay to issue PNR)
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {form.confirmation_mode === "Credit Agent" && (
            <FormField label="Credit limit" required fullWidth>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
              />
            </FormField>
          )}
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
