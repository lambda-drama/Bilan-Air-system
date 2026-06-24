"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";
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
  saveBookingAgent,
  type BookingCompanyRow,
} from "@/services/portalMaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function isAgentInactive(row: Record<string, unknown>) {
  return String(row.status || row.agent_status || "") === "Inactive";
}

function inactiveRowClass(inactive: boolean) {
  return inactive
    ? "text-destructive line-through decoration-destructive decoration-2"
    : undefined;
}

function loginStatusLabel(row: Record<string, unknown>) {
  if (row.activation_pending) return "Pending activation";
  if (row.enabled) return "Active";
  return "Disabled";
}

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
  password: "",
  password_confirm: "",
  status: "Active" as "Active" | "Inactive",
  user_type: "Agent",
  can_book_ticket: "Yes" as "Yes" | "No",
  can_confirm_ticket: "Yes" as "Yes" | "No",
  deposit_required: "No" as "Yes" | "No",
  credit_limit: "0",
};

const CREATE_STEPS = [
  { id: 1, label: "User information" },
  { id: 2, label: "User rights" },
  { id: 3, label: "Summary" },
] as const;

const EDIT_STEPS = [
  { id: 1, label: "User information" },
  { id: 2, label: "User rights" },
] as const;

type FormStep = { id: number; label: string };

function CreateAgentSummary({
  form,
  companyLabel,
  activationByEmail,
  creditEditable,
}: {
  form: typeof emptyForm;
  companyLabel: string;
  activationByEmail: boolean;
  creditEditable: boolean;
}) {
  const fullName = [form.first_name, form.last_name].filter(Boolean).join(" ").trim();
  const addressParts = [form.address_line1, form.address_line2, form.city].filter((p) => p.trim());
  const creditDisplay = creditEditable ? form.credit_limit : "0";

  return (
    <div className="space-y-4">
      <DetailSection title="User information">
        <DetailRow label="Company / agency" value={companyLabel || "—"} />
        <DetailRow label="Username" value={form.username} />
        <DetailRow label="Email" value={form.email} />
        <DetailRow label="Name" value={fullName || "—"} />
        <DetailRow label="Phone 1" value={form.phone} />
        {form.phone_2.trim() ? <DetailRow label="Phone 2" value={form.phone_2} /> : null}
        <DetailRow label="Address" value={addressParts.length ? addressParts.join(", ") : "—"} />
        <DetailRow
          label="Portal login"
          value={activationByEmail ? "Activation email" : "Password set by staff"}
        />
      </DetailSection>
      <DetailSection title="User rights">
        <DetailRow label="Active" value={form.status} />
        <DetailRow label="User type" value={form.user_type} />
        <DetailRow label="Can book ticket" value={form.can_book_ticket} />
        <DetailRow label="Can confirm ticket" value={form.can_confirm_ticket} />
        <DetailRow label="Deposit required" value={form.deposit_required} />
        <DetailRow label="Credit limit" value={creditDisplay} />
      </DetailSection>
    </div>
  );
}

function StepIndicator({
  step,
  steps,
  onStepChange,
}: {
  step: number;
  steps: readonly FormStep[];
  onStepChange: (target: number) => void;
}) {
  const stepButton = (s: FormStep) => (
    <button
      type="button"
      onClick={() => onStepChange(s.id)}
      aria-current={step === s.id ? "step" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60",
        step === s.id ? "cursor-default" : "cursor-pointer",
      )}
    >
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
    </button>
  );

  const stepArrow = () => (
    <div className="flex w-full items-center gap-1 px-2" aria-hidden="true">
      <div className="h-px flex-1 bg-muted-foreground/30" />
      <span className="shrink-0 text-base text-muted-foreground">›</span>
      <div className="h-px flex-1 bg-muted-foreground/30" />
    </div>
  );

  if (steps.length === 2) {
    return (
      <nav
        className="mb-6 grid w-full grid-cols-[auto_1fr_auto] items-center text-sm"
        aria-label="Form steps"
      >
        <div className="justify-self-start">{stepButton(steps[0])}</div>
        {stepArrow()}
        <div className="justify-self-end">{stepButton(steps[1])}</div>
      </nav>
    );
  }

  return (
    <nav
      className="mb-6 grid w-full grid-cols-[auto_1fr_auto_1fr_auto] items-center text-sm"
      aria-label="Form steps"
    >
      <div className="justify-self-start">{stepButton(steps[0])}</div>
      {stepArrow()}
      <div className="justify-self-center">{stepButton(steps[1])}</div>
      {stepArrow()}
      <div className="justify-self-end">{stepButton(steps[2])}</div>
    </nav>
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
      <SelectTrigger className="w-full">
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
  const [agentSaving, setAgentSaving] = useState(false);
  const [resendingActivation, setResendingActivation] = useState(false);
  const [activationByEmail, setActivationByEmail] = useState(true);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const formAlerts = useFormDialogAlerts();
  const isEditing = !!editingAgentId;
  const formSteps = isEditing ? EDIT_STEPS : CREATE_STEPS;
  const maxStep = formSteps.length;

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

  const selectedCompanyLabel = useMemo(() => {
    const match = companies.find((c) => c.name === form.booking_company);
    return match?.label || match?.company_agency || form.booking_company || "—";
  }, [companies, form.booking_company]);

  const creditEditable =
    form.can_confirm_ticket === "Yes" && form.deposit_required === "No";

  useEffect(() => {
    if (!open) return;
    loadCompanies();
    getBookingAgentDefaults()
      .then((defaults) => {
        setCitySuggestions(defaults.cities ?? []);
        if (editingAgentId) return;
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
        setActivationByEmail(defaults.send_booking_agent_activation_email !== 0);
      })
      .catch(() => {});
  }, [open, loadCompanies, editingAgentId]);

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
      const companyId = created.name || name;
      setForm((prev) => ({ ...prev, booking_company: companyId }));
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
        ...(isEditing
          ? []
          : [
              { key: "username", label: "Username" },
              { key: "email", label: "Email" },
            ]),
        { key: "first_name", label: "First name" },
        { key: "last_name", label: "Last name" },
        { key: "address_line1", label: "Address 1" },
        { key: "phone", label: "Phone 1" },
        { key: "city", label: "City" },
      ]);
      if (!isEditing && !activationByEmail) {
        if (!form.password.trim()) missing.push("Password");
        else if (form.password.length < 8) missing.push("Password (min 8 characters)");
        if (!form.password_confirm.trim()) missing.push("Confirm password");
        else if (form.password !== form.password_confirm) missing.push("Passwords must match");
      }
      return missing;
    }
    const missing: string[] = [];
    if (form.can_confirm_ticket === "Yes" && creditEditable && !form.credit_limit.trim()) {
      missing.push("Credit limit");
    }
    return missing;
  };

  const goToStep = (target: number) => {
    if (agentSaving) return;
    if (target === step) return;
    if (target < step) {
      formAlerts.clearAlerts();
      setStep(target);
      return;
    }
    if (target >= 2) {
      const missingStep1 = validateStep(1);
      if (missingStep1.length) {
        formAlerts.showValidation(missingStep1);
        setStep(1);
        return;
      }
    }
    if (target >= 3 && maxStep >= 3) {
      const missingStep2 = validateStep(2);
      if (missingStep2.length) {
        formAlerts.showValidation(missingStep2);
        setStep(2);
        return;
      }
    }
    formAlerts.clearAlerts();
    setStep(Math.min(target, maxStep));
  };

  const goNext = () => goToStep(step + 1);

  const agentPayload = () => ({
    booking_company: form.booking_company,
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    address_line1: form.address_line1.trim(),
    address_line2: form.address_line2.trim() || undefined,
    city: form.city.trim(),
    phone: form.phone.trim(),
    phone_2: form.phone_2.trim() || undefined,
    status: form.status,
    user_type: form.user_type,
    can_book_ticket: form.can_book_ticket,
    can_confirm_ticket: form.can_confirm_ticket,
    deposit_required: form.deposit_required,
    credit_limit: creditEditable ? parseFloat(form.credit_limit) || 0 : 0,
  });

  const handleSave = async () => {
    const missingStep1 = validateStep(1);
    const missingStep2 = validateStep(2);
    const missing = [...missingStep1, ...missingStep2];
    if (missing.length) {
      formAlerts.showValidation(missing);
      setStep(missingStep1.length ? 1 : 2);
      return;
    }
    formAlerts.clearAlerts();
    setAgentSaving(true);
    try {
      if (editingAgentId) {
        await saveBookingAgent({
          name: editingAgentId,
          ...agentPayload(),
        });
        toast.success("Booking agent updated");
      } else {
        await createBookingAgent({
          ...agentPayload(),
          username: form.username.trim(),
          email: form.email.trim(),
          password: activationByEmail ? undefined : form.password,
        });
        toast.success(
          activationByEmail
            ? "Booking agent created. Activation email sent — ask them to check spam if they don't see it."
            : "Booking agent created",
        );
      }
      setOpen(false);
      setStep(1);
      setEditingAgentId(null);
      setForm(emptyForm);
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(
        e instanceof Error
          ? e.message
          : editingAgentId
            ? "Failed to update agent"
            : "Failed to create agent",
      );
    } finally {
      setAgentSaving(false);
    }
  };

  const openCreate = () => {
    formAlerts.clearAlerts();
    setEditingAgentId(null);
    setStep(1);
    setForm(emptyForm);
    setActivationByEmail(true);
    setOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    const agentId = String(row.booking_agent || "");
    if (!agentId) {
      toast.error("No booking agent profile linked to this user.");
      return;
    }
    formAlerts.clearAlerts();
    setEditingAgentId(agentId);
    setStep(1);
    setForm({
      booking_company: String(row.booking_company || ""),
      username: String(row.username || row.name || ""),
      email: String(row.email || ""),
      first_name: String(row.first_name || ""),
      last_name: String(row.last_name || ""),
      address_line1: String(row.address_line1 || ""),
      address_line2: String(row.address_line2 || ""),
      phone: String(row.phone || row.mobile_no || ""),
      phone_2: String(row.phone_2 || ""),
      city: String(row.city || ""),
      password: "",
      password_confirm: "",
      status: (String(row.status || row.agent_status || "Active") as "Active" | "Inactive"),
      user_type: String(row.user_type || "Agent"),
      can_book_ticket: (String(row.can_book_ticket || "Yes") as "Yes" | "No"),
      can_confirm_ticket: (String(row.can_confirm_ticket || "Yes") as "Yes" | "No"),
      deposit_required: (String(row.deposit_required || "No") as "Yes" | "No"),
      credit_limit: String(row.credit_limit ?? 0),
    });
    setOpen(true);
  };

  const toggleInactive = async (row: Record<string, unknown>) => {
    const agentId = String(row.booking_agent || "");
    if (!agentId) {
      toast.error("No booking agent profile linked to this user.");
      return;
    }
    const inactive = isAgentInactive(row);
    try {
      await saveBookingAgent({
        name: agentId,
        status: inactive ? "Active" : "Inactive",
      });
      toast.success(inactive ? "Booking agent reactivated" : "Booking agent inactivated");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    }
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
                <TableHead className="w-[52px] text-right">Actions</TableHead>
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
                rows.map((u) => {
                  const inactive = isAgentInactive(u);
                  const strike = inactiveRowClass(inactive);
                  return (
                    <TableRow
                      key={String(u.name)}
                      className={cn(
                        "cursor-pointer",
                        inactive && "border-l-2 border-l-destructive bg-destructive/5",
                      )}
                      onClick={() => setSelectedUser(String(u.name))}
                    >
                      <TableCell className={cn("font-medium", strike)}>
                        {String(
                          u.company_display ||
                            u.company_agency ||
                            u.agent_name ||
                            u.full_name ||
                            u.name,
                        )}
                      </TableCell>
                      <TableCell className={strike}>{String(u.username || "—")}</TableCell>
                      <TableCell className={strike}>{String(u.city || "—")}</TableCell>
                      <TableCell className={cn(inactive && "font-medium text-destructive")}>
                        {String(u.status || u.agent_status || "—")}
                      </TableCell>
                      <TableCell className={strike}>{String(u.can_book_ticket || "—")}</TableCell>
                      <TableCell className={strike}>{String(u.can_confirm_ticket || "—")}</TableCell>
                      <TableCell className={strike}>{String(u.deposit_required || "—")}</TableCell>
                      <TableCell className={strike}>{String(u.credit_limit ?? 0)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Row actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {u.booking_agent ? (
                              <>
                                <DropdownMenuItem onClick={() => openEdit(u)}>Edit</DropdownMenuItem>
                                <DropdownMenuItem
                                  variant={inactive ? "default" : "destructive"}
                                  onClick={() => toggleInactive(u)}
                                >
                                  {inactive ? "Reactivate" : "Inactivate"}
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem disabled>No agent profile</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
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
            </DetailSection>
            <DetailSection title="Login status">
              <DetailRow label="Portal login" value={loginStatusLabel(selected)} />
              {selected.activation_pending ? (
                <DetailRow
                  label="Note"
                  value="An activation email was sent. They must set their password using the link in that email before they can log in. If they can't find it, ask them to check spam or junk mail, or resend the link below."
                />
              ) : null}
            </DetailSection>
            <div className="flex flex-col gap-2 pt-2">
              {selected.activation_pending && selected.booking_agent ? (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={resendingActivation}
                  onClick={async () => {
                    setResendingActivation(true);
                    try {
                      await resendBookingAgentActivation({
                        booking_agent: String(selected.booking_agent),
                      });
                      toast.success(
                        "Activation email sent. Ask them to check spam or junk mail if they don't see it.",
                      );
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed to send email");
                    } finally {
                      setResendingActivation(false);
                    }
                  }}
                >
                  {resendingActivation ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending email...
                    </>
                  ) : (
                    "Resend activation link"
                  )}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </DetailSheet>

      <BilanFormDialog
        open={open}
        onOpenChange={(v) => {
          if (!v && agentSaving) return;
          setOpen(v);
          if (!v) {
            setStep(1);
            setEditingAgentId(null);
            setCompanyDialogOpen(false);
            setCompanyForm(emptyCompanyForm);
            setCompanyError(null);
            setAgentSaving(false);
          }
        }}
        className="sm:max-w-4xl"
        title={isEditing ? "Edit booking agent" : "New booking agent"}
        description={
          step === 1
            ? isEditing
              ? "Update contact and address. Username and email cannot be changed here."
              : "Contact and address for the booking agent profile."
            : step === 2
              ? "Rights and credit limit for bookings and confirmations."
              : "Review details before creating the agent."
        }
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button
              variant="outline"
              disabled={agentSaving}
              onClick={() => (step === 1 ? setOpen(false) : goToStep(step - 1))}
            >
              {step === 1 ? "Cancel" : step === 2 ? "User information" : "User rights"}
            </Button>
            {step < maxStep ? (
              <Button
                className="bg-gold text-navy hover:bg-gold-dark"
                disabled={agentSaving}
                onClick={goNext}
              >
                Next
              </Button>
            ) : (
              <Button
                className="bg-gold text-navy hover:bg-gold-dark"
                disabled={agentSaving}
                onClick={() => void handleSave()}
              >
                {agentSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing
                      ? "Saving changes..."
                      : activationByEmail
                        ? "Creating agent & sending email..."
                        : "Creating agent..."}
                  </>
                ) : isEditing ? (
                  "Save changes"
                ) : (
                  "Create agent"
                )}
              </Button>
            )}
          </>
        }
      >
        <StepIndicator step={step} steps={formSteps} onStepChange={goToStep} />
        {step === 1 && (
          <div className="space-y-4">
            <FormGrid cols={1}>
              <FormField
                label="Company / agency"
                required
                hint="Select an existing company or use + to add a new one. Tick Agency only when creating a new agency."
              >
                <div className="flex w-full gap-2">
                  <SearchableSelect
                    className="min-w-0 w-full flex-1"
                    options={companyOptions}
                    value={form.booking_company}
                    valueLabel={selectedCompanyLabel !== "—" ? selectedCompanyLabel : undefined}
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
            </FormGrid>
            <FormGrid>
            <FormField label="Username" required={!isEditing}>
              <Input
                value={form.username}
                disabled={isEditing}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </FormField>
            <FormField label="Email" required={!isEditing}>
              <Input
                type="email"
                value={form.email}
                disabled={isEditing}
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
            {!isEditing && activationByEmail ? (
              <p className="col-span-full rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                An activation email will be sent when you create this agent. They must use the
                link in that email to set their password. If they don&apos;t receive it, ask them
                to check spam or junk mail.
              </p>
            ) : null}
            {!isEditing && !activationByEmail ? (
              <>
                <FormField label="Portal password" required>
                  <PasswordInput
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </FormField>
                <FormField label="Confirm password" required>
                  <PasswordInput
                    autoComplete="new-password"
                    value={form.password_confirm}
                    onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
                  />
                </FormField>
              </>
            ) : null}
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
          </FormGrid>
          </div>
        )}
        {step === 2 && (
          <FormGrid
            cols={1}
            className="[&_.bilan-form-control]:h-10 [&_.bilan-form-control_input]:h-10 [&_.bilan-form-control_[data-slot=select-trigger]]:h-10"
          >
            <FormField label="Active" required>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as "Active" | "Inactive" })}
              >
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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
            <FormField label="Deposit required?" required>
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
              hint={
                creditEditable
                  ? "Used when confirming on credit (deposit not required)."
                  : "Set to 0 when deposit is required or confirmation is disabled."
              }
            >
              <Input
                className="w-full"
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
        {step === 3 && (
          <CreateAgentSummary
            form={form}
            companyLabel={selectedCompanyLabel}
            activationByEmail={activationByEmail}
            creditEditable={creditEditable}
          />
        )}
      </BilanFormDialog>

      <BilanFormDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        stackLevel={1}
        className="sm:max-w-md"
        title="New company or agency"
        description="Companies are the default. Tick Agency only for travel agencies."
        submitError={companyError}
        onDismissAlerts={() => setCompanyError(null)}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setCompanyDialogOpen(false)}
              disabled={companySaving}
            >
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
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-secondary/20 bg-muted/40 p-3">
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
