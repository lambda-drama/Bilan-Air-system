"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { BilanFormDialog, FormField, FormGrid, FormSection } from "@/components/portal/form-dialog";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { ListSearch } from "@/components/portal/list-search";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { getMissingRequired } from "@/lib/validate-form";
import { fetchAllRoutes } from "@/services/flightRoute";
import { fetchAllAirplanes } from "@/services/airplane";
import { listCrewMembers } from "@/services/lookups";
import {
  generatePlanSchedules,
  getFlightSchedulePlanDefaults,
  listFlightSchedulePlans,
  previewPlanOccurrences,
  saveFlightSchedulePlan,
  type FlightSchedulePlanRow,
} from "@/services/flightSchedulePlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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

const WEEKDAYS = [
  { key: "sunday", label: "Sun" },
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
] as const;

const emptyForm = {
  plan_title: "",
  route: "",
  airplane: "",
  frequency: "Weekly" as "Daily" | "Weekly" | "Monthly",
  start_date: "",
  end_date: "",
  departure_time: "12:00",
  arrival_time: "13:30",
  arrival_day_offset: "0",
  status: "Scheduled",
  captain: "",
  first_officer: "",
  monthly_day: "1",
  sunday: false,
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
};

export default function RecurringFlightPlansPage() {
  const fetchRows = useCallback(async (search: string) => {
    const res = await listFlightSchedulePlans({ search: search.trim() || undefined });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, refresh } = useLiveListQuery<FlightSchedulePlanRow>(
    fetchRows,
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [routes, setRoutes] = useState<Array<{ value: string; label: string }>>([]);
  const [airplanes, setAirplanes] = useState<Array<{ value: string; label: string }>>([]);
  const [captains, setCaptains] = useState<Array<{ name: string; full_name: string }>>([]);
  const [firstOfficers, setFirstOfficers] = useState<Array<{ name: string; full_name: string }>>([]);
  const formAlerts = useFormDialogAlerts();

  useEffect(() => {
    Promise.all([
      fetchAllRoutes(),
      fetchAllAirplanes(),
      listCrewMembers({ capacity: "captain" }),
      listCrewMembers({ capacity: "first_officer" }),
    ]).then(([r, a, captainList, foList]) => {
      setRoutes(r.map((x) => ({ value: x.name, label: x.route_name || x.name })));
      setAirplanes(a.map((x) => ({ value: x.name, label: x.name })));
      const mapCrew = (list: typeof captainList) =>
        list.map((m) => ({
          name: String(m.name),
          full_name: String(m.full_name || m.name),
        }));
      setCaptains(mapCrew(captainList));
      setFirstOfficers(mapCrew(foList));
    });
  }, []);

  const buildPayload = () => ({
    plan_title: form.plan_title.trim(),
    route: form.route,
    airplane: form.airplane,
    frequency: form.frequency,
    start_date: form.start_date,
    end_date: form.end_date,
    departure_time: form.departure_time,
    arrival_time: form.arrival_time,
    arrival_day_offset: parseInt(form.arrival_day_offset, 10) || 0,
    status: form.status,
    captain: form.captain,
    first_officer: form.first_officer,
    monthly_day: form.frequency === "Monthly" ? parseInt(form.monthly_day, 10) || 1 : undefined,
    sunday: form.sunday ? 1 : 0,
    monday: form.monday ? 1 : 0,
    tuesday: form.tuesday ? 1 : 0,
    wednesday: form.wednesday ? 1 : 0,
    thursday: form.thursday ? 1 : 0,
    friday: form.friday ? 1 : 0,
    saturday: form.saturday ? 1 : 0,
  });

  const handlePreview = async () => {
    try {
      const res = await previewPlanOccurrences(buildPayload());
      setPreviewCount(res.count);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    }
  };

  const handleCreate = async () => {
    const missing = getMissingRequired(form, [
      { key: "plan_title", label: "Plan title" },
      { key: "route", label: "Route" },
      { key: "airplane", label: "Airplane" },
      { key: "start_date", label: "Start date" },
      { key: "end_date", label: "End date" },
      { key: "captain", label: "Captain" },
      { key: "first_officer", label: "First officer" },
    ]);
    if (form.frequency === "Weekly" && !WEEKDAYS.some((d) => form[d.key])) {
      missing.push("At least one weekday");
    }
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    formAlerts.clearAlerts();
    try {
      const saved = await saveFlightSchedulePlan(buildPayload());
      const planName = String(saved.name);
      const gen = await generatePlanSchedules(planName);
      toast.success(`Plan saved. Created ${gen.created_count} flight(s).`);
      setOpen(false);
      setForm(emptyForm);
      setPreviewCount(null);
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save plan");
    }
  };

  const openCreateDialog = async () => {
    formAlerts.clearAlerts();
    setPreviewCount(null);
    try {
      const defaults = await getFlightSchedulePlanDefaults();
      setForm({ ...emptyForm, plan_title: defaults.suggested_plan_title });
    } catch {
      setForm(emptyForm);
    }
    setOpen(true);
  };

  const handleGenerate = async (planName: string) => {
    try {
      const gen = await generatePlanSchedules(planName);
      toast.success(`Created ${gen.created_count} flight(s), skipped ${gen.skipped_count}.`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generate failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/portal/flights"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to flights
          </Link>
          <h1 className="text-2xl font-bold">Recurring flight plans</h1>
          <p className="text-muted-foreground">
            Daily, weekly, or monthly schedules — generates individual flights for each date
          </p>
        </div>
        <PortalAddButton onClick={() => void openCreateDialog()}>
          New recurring plan
        </PortalAddButton>
      </div>

      <ListSearch value={search} onChange={setSearch} placeholder="Search plans..." />

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No recurring plans yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{p.plan_title}</TableCell>
                    <TableCell>{p.frequency}</TableCell>
                    <TableCell>
                      {p.start_date} → {p.end_date}
                    </TableCell>
                    <TableCell>{p.route}</TableCell>
                    <TableCell>{p.generated_count ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleGenerate(p.name)}>
                        Generate
                      </Button>
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
        title="Recurring flight plan"
        description="Matches daily, weekly (by weekday), or monthly patterns between start and end dates."
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handlePreview}>
              Preview count
              {previewCount != null ? ` (${previewCount})` : ""}
            </Button>
            <Button className="bg-gold text-navy hover:bg-gold-dark" onClick={handleCreate}>
              Save & generate flights
            </Button>
          </>
        }
      >
        <FormGrid>
          <FormField
            label="Plan title"
            required
            fullWidth
            hint="Auto-generated (RFP-000001). You can change it before saving."
          >
            <Input
              value={form.plan_title}
              onChange={(e) => setForm({ ...form, plan_title: e.target.value })}
              placeholder="RFP-000001"
            />
          </FormField>
          <FormField label="Frequency" required>
            <Select
              value={form.frequency}
              onValueChange={(v) =>
                setForm({ ...form, frequency: v as "Daily" | "Weekly" | "Monthly" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Daily">Daily</SelectItem>
                <SelectItem value="Weekly">Weekly</SelectItem>
                <SelectItem value="Monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Start date" required>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </FormField>
          <FormField label="End date" required>
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </FormField>
          {form.frequency === "Monthly" && (
            <FormField label="Day of month" required>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.monthly_day}
                onChange={(e) => setForm({ ...form, monthly_day: e.target.value })}
              />
            </FormField>
          )}
          <FormField label="Route" required fullWidth>
            <SearchableSelect
              value={form.route}
              onValueChange={(v) => setForm({ ...form, route: v })}
              options={routes}
              placeholder="Select route"
            />
          </FormField>
          <FormField label="Airplane" required fullWidth>
            <SearchableSelect
              value={form.airplane}
              onValueChange={(v) => setForm({ ...form, airplane: v })}
              options={airplanes}
              placeholder="Select airplane"
            />
          </FormField>
          <FormField label="Departure time" required>
            <Input
              type="time"
              value={form.departure_time}
              onChange={(e) => setForm({ ...form, departure_time: e.target.value })}
            />
          </FormField>
          <FormField label="Arrival time" required>
            <Input
              type="time"
              value={form.arrival_time}
              onChange={(e) => setForm({ ...form, arrival_time: e.target.value })}
            />
          </FormField>
          <FormField label="Captain" required>
            <SearchableSelect
              value={form.captain}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  captain: v,
                  first_officer: v && form.first_officer === v ? "" : form.first_officer,
                })
              }
              options={captains.map((c) => ({ value: c.name, label: c.full_name }))}
              placeholder="Select captain"
              clearable={false}
            />
          </FormField>
          <FormField label="First officer" required>
            <SearchableSelect
              value={form.first_officer}
              onValueChange={(v) => setForm({ ...form, first_officer: v })}
              options={firstOfficers
                .filter((c) => c.name !== form.captain)
                .map((c) => ({ value: c.name, label: c.full_name }))}
              placeholder="Select first officer"
              clearable={false}
            />
          </FormField>
        </FormGrid>

        {form.frequency === "Weekly" && (
          <FormSection title="Days of week">
            <div className="flex flex-wrap gap-4">
              {WEEKDAYS.map((d) => (
                <div key={d.key} className="flex items-center gap-2">
                  <Checkbox
                    id={d.key}
                    checked={form[d.key]}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, [d.key]: checked === true })
                    }
                  />
                  <Label htmlFor={d.key}>{d.label}</Label>
                </div>
              ))}
            </div>
          </FormSection>
        )}
      </BilanFormDialog>
    </div>
  );
}
