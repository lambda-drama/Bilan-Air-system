"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { BilanFormDialog, FormField, FormGrid } from "@/components/portal/form-dialog";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { ListSearch } from "@/components/portal/list-search";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { getMissingRequired } from "@/lib/validate-form";
import { cn } from "@/lib/utils";
import {
  createBookingAgent,
  createBookingCompany,
  getBookingAgentDefaults,
  listBookingAgents,
  listBookingCompanies,
  resendBookingAgentActivation,
  type BookingCompanyRow,
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const YES_NO = ["Yes", "No"] as const;

const emptyCompanyForm = {
  company_agency: "",
  is_agency: false,
};

const emptyForm = {
  booking_company: "",
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  address_line1: "",
  address_line2: "",
  phone: "",
  phone_2: "",
  city: "",
  send_activation_email: true,
  status: "Active" as "Active" | "Inactive",
  user_type: "Agent",
  can_book_ticket: "Yes" as "Yes" | "No",
  can_confirm_ticket: "Yes" as "Yes" | "No",
  deposit_required: "No" as "Yes" | "No",
  credit_limit: "0",
};

const STEPS = [
  { id: 1, label: "User information" },
  { id: 2, label: "User rights" },
] as const;

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="mb-6 flex items-center gap-3 text-sm">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          {i > 0 && <span className="text-muted-foreground">›</span>}
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
              step === s.id
                ? "bg-navy text-white"
                : step > s.id
                  ? "bg-gold/30 text-navy"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {s.id}
          </span>
          <span className={step === s.id ? "font-medium text-foreground" : "text-muted-foreground"}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function YesNoSelect({
  value,
  onValueChange,
}: {
  value: "Yes" | "No";
  onValueChange: (v: "Yes" | "No") => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as "Yes" | "No")}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {YES_NO.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function PortalBookingAgentsPage() {
  const fetchRows = useCallback(async (search: string) => {
    const res = await listBookingAgents({ limit: 200, search: search.trim() || undefined });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, error, refresh } = useLiveListQuery(fetchRows);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [companies, setCompanies] = useState<BookingCompanyRow[]>([]);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const formAlerts = useFormDialogAlerts();

  const loadCompanies = useCallback(async () => {
    try {
      const res = await listBookingCompanies({ limit: 500 });
      setCompanies(res.data);
    } catch {
      setCompanies([]);
    }
  }, []);

  const companyOptions = useMemo(
    () =>
      companies.map((c) => ({
        value: c.name,
        label: c.label || c.company_agency,
      })),
    [companies],
  );

  const creditEditable =
    form.can_confirm_ticket === "Yes" && form.deposit_required === "No";

  useEffect(() => {
    if (!open) return;
    loadCompanies();
    getBookingAgentDefaults()
      .then((defaults) => {
        setForm((prev) => ({
          ...prev,
          status: (defaults.status as "Active" | "Inactive") || "Active",
          user_type: defaults.user_type || "Agent",
          can_book_ticket: (defaults.can_book_ticket as "Yes" | "No") || "Yes",
          can_confirm_ticket: (defaults.can_confirm_ticket as "Yes" | "No") || "Yes",
          deposit_required: (defaults.deposit_required as "Yes" | "No") || "No",
          credit_limit:
            defaults.credit_limit != null ? String(defaults.credit_limit) : prev.credit_limit,
        }));
        setCitySuggestions(defaults.cities ?? []);
      })
      .catch(() => {});
  }, [open, loadCompanies]);

  const handleCreateCompany = async () => {
    const name = companyForm.company_agency.trim();
    if (!name) {
      setCompanyError("Company or agency name is required");
      return;
    }
    setCompanyError(null);
    setCompanySaving(true);
    try {
      const created = await createBookingCompany({
        company_agency: name,
        is_agency: companyForm.is_agency,
      });
      await loadCompanies();
      setForm((prev) => ({ ...prev, booking_company: created.name }));
      setCompanyForm(emptyCompanyForm);
      setCompanyDialogOpen(false);
      toast.success(companyForm.is_agency ? "Agency created" : "Company created");
    } catch (e) {
      setCompanyError(e instanceof Error ? e.message : "Failed to create company");
    } finally {
      setCompanySaving(false);
    }
  };

  const selected = useMemo(
    () => rows.find((r) => String(r.name) === selectedUser) ?? null,
    [rows, selectedUser],
  );

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      const missing = getMissingRequired(form, [
        { key: "booking_company", label: "Company / agency" },
        { key: "username", label: "Username" },
        { key: "email", label: "Email" },
        { key: "first_name", label: "First name" },
        { key: "last_name", label: "Last name" },
        { key: "address_line1", label: "Address 1" },
        { key: "phone", label: "Phone 1" },
        { key: "city", label: "City" },
      ]);
      if (!form.send_activation_email) {
        missing.push("Send activation email");
      }
      return missing;
    }
    const missing: string[] = [];
    if (form.can_confirm_ticket === "Yes" && creditEditable && !form.credit_limit.trim()) {
      missing.push("Credit limit");
    }
    return missing;
  };

  const goNext = () => {
    const missing = validateStep(1);
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    formAlerts.clearAlerts();
    setStep(2);
  };

  const handleCreate = async () => {
    const missing = [...validateStep(1), ...validateStep(2)];
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    formAlerts.clearAlerts();
    try {
      await createBookingAgent({
        booking_company: form.booking_company,
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        address_line1: form.address_line1.trim(),
        address_line2: form.address_line2.trim() || undefined,
        city: form.city.trim(),
        phone: form.phone.trim(),
        phone_2: form.phone_2.trim() || undefined,
        send_activation_email: form.send_activation_email ? 1 : 0,
        status: form.status,
        user_type: form.user_type,
        can_book_ticket: form.can_book_ticket,
        can_confirm_ticket: form.can_confirm_ticket,
        deposit_required: form.deposit_required,
        credit_limit: creditEditable ? parseFloat(form.credit_limit) || 0 : 0,
      });
      toast.success("Booking agent created");
      setOpen(false);
      setStep(1);
      setForm(emptyForm);
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to create agent");
    }
  };

  const openCreate = () => {
    formAlerts.clearAlerts();
    setStep(1);
    setForm(emptyForm);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Booking agents</h1>
          <p className="text-muted-foreground">
            Contact and address on the agent profile; login user is created automatically. Rights
            control booking and confirmation.
          </p>
        </div>
        <PortalAddButton onClick={openCreate}>New booking agent</PortalAddButton>
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
                <TableHead>City</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Can book</TableHead>
                <TableHead>Can confirm</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Credit limit</TableHead>
                <TableHead>Login</TableHead>
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
                      {String(
                        u.company_display || u.company_agency || u.agent_name || u.full_name || u.name,
                      )}
                    </TableCell>
                    <TableCell>{String(u.username || "—")}</TableCell>
                    <TableCell>{String(u.city || "—")}</TableCell>
                    <TableCell>{String(u.status || u.agent_status || "—")}</TableCell>
                    <TableCell>{String(u.can_book_ticket || "—")}</TableCell>
                    <TableCell>{String(u.can_confirm_ticket || "—")}</TableCell>
                    <TableCell>{String(u.deposit_required || "—")}</TableCell>
                    <TableCell>{String(u.credit_limit ?? 0)}</TableCell>
                    <TableCell>
                      {u.activation_pending
                        ? "Pending activation"
                        : u.enabled
                          ? "Active"
                          : "Disabled"}
                    </TableCell>
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
        title={String(
          selected?.company_display ||
            selected?.company_agency ||
            selected?.agent_name ||
            selected?.full_name ||
            "Booking agent",
        )}
        description={String(selected?.email || "")}
      >
        {selected && (
          <>
            <DetailSection title="User information">
              <DetailRow
                label="Company / agency"
                value={String(
                  selected.company_display || selected.company_agency || selected.agent_name || "—",
                )}
              />
              {selected.is_agency ? (
                <DetailRow label="Type" value="Agency" />
              ) : selected.booking_company ? (
                <DetailRow label="Type" value="Company" />
              ) : null}
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
            <DetailSection title="User rights">
              <DetailRow label="Active" value={String(selected.status || selected.agent_status || "—")} />
              <DetailRow label="User type" value={String(selected.user_type || "Agent")} />
              <DetailRow label="Can book ticket" value={String(selected.can_book_ticket || "—")} />
              <DetailRow label="Can confirm ticket" value={String(selected.can_confirm_ticket || "—")} />
              <DetailRow label="Deposit required" value={String(selected.deposit_required || "—")} />
              <DetailRow label="Credit limit" value={String(selected.credit_limit ?? 0)} />
              <DetailRow label="Credit available" value={String(selected.credit_available ?? 0)} />
              <DetailRow
                label="Portal login"
                value={
                  selected.activation_pending
                    ? "Pending — must set password via email"
                    : selected.enabled
                      ? "Active"
                      : "Disabled"
                }
              />
            </DetailSection>
            {selected.activation_pending && selected.booking_agent ? (
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    try {
                      await resendBookingAgentActivation({
                        booking_agent: String(selected.booking_agent),
                      });
                      toast.success("Activation email sent");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed to send email");
                    }
                  }}
                >
                  Resend activation link
                </Button>
              </div>
            ) : null}
          </>
        )}
      </DetailSheet>

      <BilanFormDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setStep(1);
        }}
        className="sm:max-w-2xl"
        title="New booking agent"
        description={
          step === 1
            ? "Step 1 — contact and address (stored on Booking Agent + ERPNext Address)."
            : "Step 2 — rights and credit (managed on Booking Agent only)."
        }
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => (step === 1 ? setOpen(false) : setStep(1))}
            >
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            {step === 1 ? (
              <Button className="bg-gold text-navy hover:bg-gold-dark" onClick={goNext}>
                Next
              </Button>
            ) : (
              <Button className="bg-gold text-navy hover:bg-gold-dark" onClick={handleCreate}>
                Create agent
              </Button>
            )}
          </>
        }
      >
        <StepIndicator step={step} />
        {step === 1 ? (
          <FormGrid>
            <FormField
              label="Company / agency"
              required
              fullWidth
              hint="Select an existing company or use + to add a new one. Tick Agency only when creating a new agency."
            >
              <div className="flex gap-2">
                <SearchableSelect
                  className="min-w-0 flex-1"
                  options={companyOptions}
                  value={form.booking_company}
                  onValueChange={(v) => setForm({ ...form, booking_company: v })}
                  placeholder="Search company or agency..."
                  emptyMessage="No companies found — use + to add one"
                  clearable={false}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-label="Add company or agency"
                  onClick={() => {
                    setCompanyError(null);
                    setCompanyForm(emptyCompanyForm);
                    setCompanyDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
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
            <FormField
              label="Portal login"
              fullWidth
              hint="User receives an email to set their password. Login is enabled only after they complete activation."
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                <Checkbox
                  checked={form.send_activation_email}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, send_activation_email: checked === true })
                  }
                />
                <span className="text-sm leading-snug">
                  Send activation email — agent sets their own password (recommended)
                </span>
              </label>
            </FormField>
          </FormGrid>
        ) : (
          <FormGrid>
            <FormField label="Active" required>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as "Active" | "Inactive" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="User type" required>
              <Select
                value={form.user_type}
                onValueChange={(v) => setForm({ ...form, user_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Agent">Agent</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Can book ticket?" required>
              <YesNoSelect
                value={form.can_book_ticket}
                onValueChange={(v) => setForm({ ...form, can_book_ticket: v })}
              />
            </FormField>
            <FormField label="Can confirm ticket?" required>
              <YesNoSelect
                value={form.can_confirm_ticket}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    can_confirm_ticket: v,
                    credit_limit: v === "No" ? "0" : form.credit_limit,
                  })
                }
              />
            </FormField>
            <FormField label="Deposit required?" required fullWidth>
              <YesNoSelect
                value={form.deposit_required}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    deposit_required: v,
                    credit_limit: v === "Yes" ? "0" : form.credit_limit,
                  })
                }
              />
            </FormField>
            <FormField
              label="Credit limit"
              required={creditEditable}
              fullWidth
              hint={
                creditEditable
                  ? "Used when confirming on credit (deposit not required)."
                  : "Set to 0 when deposit is required or confirmation is disabled."
              }
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={!creditEditable}
                value={creditEditable ? form.credit_limit : "0"}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
              />
            </FormField>
          </FormGrid>
        )}
      </BilanFormDialog>

      <BilanFormDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        className="sm:max-w-md"
        title="New company or agency"
        description="Companies are the default. Tick Agency only for travel agencies."
        submitError={companyError}
        onDismissAlerts={() => setCompanyError(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCompanyDialogOpen(false)} disabled={companySaving}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold-dark"
              onClick={handleCreateCompany}
              disabled={companySaving}
            >
              {companySaving ? "Saving..." : "Create"}
            </Button>
          </>
        }
      >
        <FormGrid>
          <FormField label="Name" required fullWidth>
            <Input
              value={companyForm.company_agency}
              onChange={(e) => setCompanyForm({ ...companyForm, company_agency: e.target.value })}
              placeholder="e.g. Acme Travel"
            />
          </FormField>
          <FormField label="Type" fullWidth>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <Checkbox
                checked={companyForm.is_agency}
                onCheckedChange={(checked) =>
                  setCompanyForm({ ...companyForm, is_agency: checked === true })
                }
              />
              <span className="text-sm leading-snug">
                This is an agency — leave unchecked for a regular company
              </span>
            </label>
          </FormField>
        </FormGrid>
      </BilanFormDialog>
    </div>
  );
}
