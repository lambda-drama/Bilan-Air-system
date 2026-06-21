"use client";

import { useEffect, useMemo, useState } from "react";
import { BilanFormDialog, FormField, FormGrid, FormSection } from "@/components/portal/form-dialog";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { getMissingRequired } from "@/lib/validate-form";
import { layoutSeatCountsByClass } from "@/lib/airplane-seat-layout";
import { fetchAllRoutes } from "@/services/flightRoute";
import { fetchAllAirplanes, fetchAirplaneSeatConfig } from "@/services/airplane";
import { listCrewMembers } from "@/services/lookups";
import {
  getFlightSchedulePlan,
  getFlightSchedulePlanDefaults,
  previewPlanOccurrences,
  saveFlightSchedulePlan,
} from "@/services/flightSchedulePlan";
import { useFlightPlanGeneration } from "@/contexts/flight-plan-generation-context";
import { listFlightSetups } from "@/services/flightSchedule";
import { getFlightSetup, type FlightSetupMasterRow } from "@/services/flightSetup";
import { getAirplane, listSeatClasses } from "@/services/portalMaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WEEKDAYS = [
  { key: "sunday", label: "Sun" },
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
] as const;

export type PlanSeatClassRow = {
  seat_class: string;
  number_of_seats: string;
  reserved_seats: string;
  name?: string;
};

function parseDocSeatClasses(doc: Record<string, unknown>): PlanSeatClassRow[] {
  const rows = doc.seat_classes;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      seat_class: String(r.seat_class || ""),
      number_of_seats: String(r.number_of_seats ?? ""),
      reserved_seats: String(r.reserved_seats ?? "0"),
      ...(r.name ? { name: String(r.name) } : {}),
    };
  });
}

function mergeSeatClassGrid(
  options: Array<{ value: string; label: string }>,
  saved: PlanSeatClassRow[],
  layoutCapMap: Record<string, number> = {},
  prefillFromLayout = false,
): PlanSeatClassRow[] {
  const gridOptions =
    options.length > 0
      ? options
      : Object.keys(layoutCapMap).map((seat_class) => ({ value: seat_class, label: seat_class }));
  if (!gridOptions.length) return saved;
  const byClass = Object.fromEntries(saved.filter((r) => r.seat_class).map((r) => [r.seat_class, r]));
  return gridOptions.map((opt) => {
    const existing = byClass[opt.value];
    const layoutCap = layoutCapMap[opt.value];
    let number_of_seats = existing?.number_of_seats ?? "0";
    let reserved_seats = existing?.reserved_seats ?? "0";
    if (prefillFromLayout) {
      number_of_seats = layoutCap != null ? String(layoutCap) : "0";
      reserved_seats = "0";
    }
    return {
      seat_class: opt.value,
      number_of_seats,
      reserved_seats,
      ...(existing?.name ? { name: existing.name } : {}),
    };
  });
}

function seatQuotaForClass(rows: PlanSeatClassRow[], seatClass: string): string {
  return rows.find((r) => r.seat_class === seatClass)?.number_of_seats ?? "0";
}

function seatReservedForClass(rows: PlanSeatClassRow[], seatClass: string): string {
  return rows.find((r) => r.seat_class === seatClass)?.reserved_seats ?? "0";
}

type SeatClassOption = { value: string; label: string; description?: string };

function seatClassOptionsFromLayout(
  layoutCaps: Record<string, number>,
  known: SeatClassOption[],
): SeatClassOption[] {
  const byValue = Object.fromEntries(known.map((o) => [o.value, o]));
  return Object.entries(layoutCaps)
    .filter(([, cap]) => cap > 0)
    .map(([value]) => byValue[value] || { value, label: value });
}

export const emptyRecurringPlanForm = {
  name: "",
  flight_number: "",
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
  seat_classes: [] as PlanSeatClassRow[],
};

export type RecurringPlanFormState = typeof emptyRecurringPlanForm;

function docToForm(doc: Record<string, unknown>, flightNumberFallback = ""): RecurringPlanFormState {
  return {
    name: String(doc.name || ""),
    flight_number: String(doc.flight_number || flightNumberFallback || ""),
    plan_title: String(doc.plan_title || ""),
    route: String(doc.route || ""),
    airplane: String(doc.airplane || ""),
    frequency: (doc.frequency as RecurringPlanFormState["frequency"]) || "Weekly",
    start_date: String(doc.start_date || ""),
    end_date: String(doc.end_date || ""),
    departure_time: String(doc.departure_time || "12:00").slice(0, 5),
    arrival_time: String(doc.arrival_time || "13:30").slice(0, 5),
    arrival_day_offset: String(doc.arrival_day_offset ?? "0"),
    status: String(doc.status || "Scheduled"),
    captain: String(doc.captain || ""),
    first_officer: String(doc.first_officer || ""),
    monthly_day: String(doc.monthly_day || "1"),
    sunday: !!doc.sunday,
    monday: !!doc.monday,
    tuesday: !!doc.tuesday,
    wednesday: !!doc.wednesday,
    thursday: !!doc.thursday,
    friday: !!doc.friday,
    saturday: !!doc.saturday,
    seat_classes: parseDocSeatClasses(doc),
  };
}

export type RecurringPlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, loads plan for edit. When null/undefined, opens create form. */
  planName?: string | null;
  /** Prefill flight setup on create (e.g. from flight setup plans page). */
  defaultFlightNumber?: string;
  onSaved?: () => void;
};

export function RecurringPlanDialog({
  open,
  onOpenChange,
  planName,
  defaultFlightNumber,
  onSaved,
}: RecurringPlanDialogProps) {
  const { trackGeneration } = useFlightPlanGeneration();
  const [form, setForm] = useState(emptyRecurringPlanForm);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [routes, setRoutes] = useState<Array<{ value: string; label: string }>>([]);
  const [airplanes, setAirplanes] = useState<Array<{ value: string; label: string }>>([]);
  const [captains, setCaptains] = useState<Array<{ name: string; full_name: string }>>([]);
  const [firstOfficers, setFirstOfficers] = useState<Array<{ name: string; full_name: string }>>([]);
  const [flightSetups, setFlightSetups] = useState<FlightSetupMasterRow[]>([]);
  const [flightSetupsLoading, setFlightSetupsLoading] = useState(false);
  const [seatClassOptions, setSeatClassOptions] = useState<SeatClassOption[]>([]);
  const [seatClassesLoading, setSeatClassesLoading] = useState(false);
  const [layoutCapsByClass, setLayoutCapsByClass] = useState<Record<string, number>>({});
  const [layoutCapsLoading, setLayoutCapsLoading] = useState(false);
  const [useAirplaneSeats, setUseAirplaneSeats] = useState(false);
  const formAlerts = useFormDialogAlerts();

  const displaySeatClassOptions = useMemo(() => {
    if (!useAirplaneSeats) return seatClassOptions;
    const fromLayout = seatClassOptionsFromLayout(layoutCapsByClass, seatClassOptions);
    if (fromLayout.length) return fromLayout;
    return seatClassOptions;
  }, [useAirplaneSeats, layoutCapsByClass, seatClassOptions]);

  const loadSeatClasses = async (): Promise<SeatClassOption[]> => {
    setSeatClassesLoading(true);
    try {
      const rows = await listSeatClasses(true);
      const list = Array.isArray(rows) ? rows : [];
      const options = list.map((sc) => ({
        value: sc.name,
        label: sc.class_name || sc.name,
        description: sc.cabin_class || undefined,
      }));
      setSeatClassOptions(options);
      return options;
    } catch {
      setSeatClassOptions([]);
      return [];
    } finally {
      setSeatClassesLoading(false);
    }
  };

  const applyAirplaneSeatClasses = async (
    airplaneName: string,
    prefillFromLayout = false,
    classOptions: SeatClassOption[] = seatClassOptions,
    useLayoutSeats: boolean = useAirplaneSeats,
  ) => {
    if (!airplaneName) {
      setLayoutCapsByClass({});
      return;
    }
    if (!useLayoutSeats) {
      setLayoutCapsByClass({});
      setForm((f) => ({
        ...f,
        seat_classes: mergeSeatClassGrid(classOptions, f.seat_classes),
      }));
      return;
    }
    setLayoutCapsLoading(true);
    try {
      let seatConfig: Array<Record<string, unknown>> = [];
      try {
        const airplane = await getAirplane(airplaneName);
        seatConfig = Array.isArray(airplane.seat_config) ? airplane.seat_config : [];
      } catch {
        seatConfig = [];
      }
      if (!seatConfig.length) {
        seatConfig = await fetchAirplaneSeatConfig(airplaneName);
      }
      const capMap = layoutSeatCountsByClass(seatConfig);
      setLayoutCapsByClass(capMap);
      const layoutOptions = seatClassOptionsFromLayout(capMap, classOptions);
      const gridOptions = layoutOptions.length ? layoutOptions : classOptions;
      setForm((f) => ({
        ...f,
        seat_classes: mergeSeatClassGrid(gridOptions, f.seat_classes, capMap, prefillFromLayout),
      }));
    } catch {
      setLayoutCapsByClass({});
    } finally {
      setLayoutCapsLoading(false);
    }
  };

  const setSeatClassQuota = (seatClass: string, value: string) => {
    setForm((f) => {
      const next = mergeSeatClassGrid(displaySeatClassOptions, f.seat_classes);
      const idx = next.findIndex((r) => r.seat_class === seatClass);
      if (idx >= 0) {
        const total = parseInt(value, 10) || 0;
        const reserved = parseInt(next[idx].reserved_seats, 10) || 0;
        next[idx] = {
          ...next[idx],
          number_of_seats: value,
          reserved_seats: String(Math.min(reserved, total)),
        };
      }
      return { ...f, seat_classes: next };
    });
  };

  const setSeatClassReserved = (seatClass: string, value: string) => {
    setForm((f) => {
      const next = mergeSeatClassGrid(displaySeatClassOptions, f.seat_classes);
      const idx = next.findIndex((r) => r.seat_class === seatClass);
      if (idx >= 0) {
        const total = parseInt(next[idx].number_of_seats, 10) || 0;
        const reserved = Math.min(parseInt(value, 10) || 0, total);
        next[idx] = { ...next[idx], reserved_seats: String(reserved) };
      }
      return { ...f, seat_classes: next };
    });
  };

  const flightSetupOptions = flightSetups.map((f) => {
    const endpoints =
      f.origin_label && f.destination_label
        ? `${f.origin_label} → ${f.destination_label}`
        : f.route_label || f.route || "";
    return {
      value: f.flight_number,
      label: endpoints ? `${f.flight_number} · ${endpoints}` : f.flight_number,
      description: f.airplane_label || f.airplane || undefined,
    };
  });

  const selectedFlightSetup = flightSetups.find((f) => f.flight_number === form.flight_number);
  const selectedRouteLabel =
    selectedFlightSetup?.origin_label && selectedFlightSetup?.destination_label
      ? `${selectedFlightSetup.origin_label} → ${selectedFlightSetup.destination_label}`
      : routes.find((r) => r.value === form.route)?.label || selectedFlightSetup?.route_label || "";

  const loadFlightSetups = async () => {
    setFlightSetupsLoading(true);
    try {
      const res = await listFlightSetups({ limit: 200 });
      setFlightSetups(res.data || []);
    } catch {
      setFlightSetups([]);
    } finally {
      setFlightSetupsLoading(false);
    }
  };

  const applyFlightSetupSelection = async (
    flightNumber: string,
    classOptions: SeatClassOption[] = seatClassOptions,
    useLayoutSeats: boolean = useAirplaneSeats,
  ) => {
    if (!flightNumber) {
      setForm((f) => ({ ...f, flight_number: "" }));
      return;
    }
    let setup = flightSetups.find((f) => f.flight_number === flightNumber);
    if (!setup?.route) {
      try {
        const detail = await getFlightSetup(flightNumber);
        if (!detail.has_master || !detail.route) {
          toast.error("Flight setup not found. Create it under Flights → Flight setup first.");
          return;
        }
        setup = {
          flight_number: flightNumber,
          route: detail.route,
          airplane: detail.airplane,
          origin_label: detail.origin_label,
          destination_label: detail.destination_label,
          route_label: detail.route_label,
          has_master: 1,
        };
        setFlightSetups((prev) => {
          if (prev.some((p) => p.flight_number === flightNumber)) {
            return prev.map((p) => (p.flight_number === flightNumber ? { ...p, ...setup! } : p));
          }
          return [...prev, setup!];
        });
      } catch {
        toast.error("Flight setup not found. Create it under Flights → Flight setup first.");
        return;
      }
    }
    setForm((f) => ({
      ...f,
      flight_number: flightNumber,
      route: setup!.route,
      airplane: setup!.airplane || f.airplane,
    }));
    if (setup!.airplane && useLayoutSeats) {
      void applyAirplaneSeatClasses(setup!.airplane, true, classOptions, useLayoutSeats);
    }
  };

  const prefillFromFlightSetup = async (
    flightNumber: string,
    classOptions: SeatClassOption[] = seatClassOptions,
    useLayoutSeats: boolean = useAirplaneSeats,
  ) => {
    await applyFlightSetupSelection(flightNumber, classOptions, useLayoutSeats);
  };

  useEffect(() => {
    void loadFlightSetups();

    void loadSeatClasses();

    Promise.allSettled([
      fetchAllRoutes(),
      fetchAllAirplanes(),
      listCrewMembers({ capacity: "captain" }),
      listCrewMembers({ capacity: "first_officer" }),
    ]).then(([routesResult, airplanesResult, captainResult, foResult]) => {
      if (routesResult.status === "fulfilled") {
        setRoutes(
          routesResult.value.map((x) => ({ value: x.name, label: x.route_name || x.name })),
        );
      }
      if (airplanesResult.status === "fulfilled") {
        setAirplanes(airplanesResult.value.map((x) => ({ value: x.name, label: x.name })));
      }
      const mapCrew = (list: Array<{ name?: string; full_name?: string }>) =>
        list.map((m) => ({
          name: String(m.name),
          full_name: String(m.full_name || m.name),
        }));
      if (captainResult.status === "fulfilled") {
        setCaptains(mapCrew(captainResult.value));
      }
      if (foResult.status === "fulfilled") {
        setFirstOfficers(mapCrew(foResult.value));
      }
    });
  }, []);

  useEffect(() => {
    if (!open || !displaySeatClassOptions.length) return;
    setForm((f) => ({
      ...f,
      seat_classes: mergeSeatClassGrid(
        displaySeatClassOptions,
        f.seat_classes,
        layoutCapsByClass,
      ),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync grid when class list arrives
  }, [open, displaySeatClassOptions, layoutCapsByClass]);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      return;
    }

    formAlerts.clearAlerts();
    setPreviewCount(null);
    setLoading(true);

    const load = async () => {
      try {
        await loadFlightSetups();
        const loadedSeatClasses = await loadSeatClasses();
        const defaults = await getFlightSchedulePlanDefaults();
        const layoutSeatsEnabled = !!defaults.use_airplane_seats;
        setUseAirplaneSeats(layoutSeatsEnabled);

        if (planName) {
          const doc = await getFlightSchedulePlan(planName);
          const loaded = docToForm(doc, defaultFlightNumber || "");
          setForm({
            ...loaded,
            seat_classes: mergeSeatClassGrid(loadedSeatClasses, loaded.seat_classes),
          });
          const fn = String(doc.flight_number || defaultFlightNumber || "");
          if (fn) await prefillFromFlightSetup(fn, loadedSeatClasses, layoutSeatsEnabled);
          if (doc.airplane && layoutSeatsEnabled) {
            await applyAirplaneSeatClasses(String(doc.airplane), false, loadedSeatClasses, layoutSeatsEnabled);
          }
          return;
        }

        setForm({
          ...emptyRecurringPlanForm,
          flight_number: defaultFlightNumber || "",
          plan_title: defaults.suggested_plan_title,
          seat_classes: mergeSeatClassGrid(loadedSeatClasses, []),
        });
        if (defaultFlightNumber) {
          await prefillFromFlightSetup(defaultFlightNumber, loadedSeatClasses, layoutSeatsEnabled);
        }
      } catch (e) {
        formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to load form");
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    };

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when dialog opens for a different plan
  }, [open, planName, defaultFlightNumber]);

  const buildPayload = () => ({
    ...(form.name ? { name: form.name } : {}),
    ...(form.flight_number ? { flight_number: form.flight_number } : {}),
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
    seat_classes: mergeSeatClassGrid(displaySeatClassOptions, form.seat_classes).map((row) => ({
      ...(row.name ? { name: row.name } : {}),
      seat_class: row.seat_class,
      number_of_seats: parseInt(row.number_of_seats, 10) || 0,
      reserved_seats: parseInt(row.reserved_seats, 10) || 0,
    })),
  });

  const handlePreview = async () => {
    try {
      const res = await previewPlanOccurrences(buildPayload());
      setPreviewCount(res.count);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    }
  };

  const handleSave = async () => {
    const missing = getMissingRequired(form, [
      { key: "plan_title", label: "Plan title" },
      { key: "route", label: "Route" },
      { key: "airplane", label: "Airplane" },
      { key: "start_date", label: "Start date" },
      { key: "end_date", label: "End date" },
    ]);
    if (form.frequency === "Weekly" && !WEEKDAYS.some((d) => form[d.key])) {
      missing.push("At least one weekday");
    }
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    formAlerts.clearAlerts();
    setSubmitting(true);
    try {
      const isNew = !form.name;
      const saved = await saveFlightSchedulePlan(buildPayload());
      const generation = saved.generation as
        | { queued?: boolean; expected_count?: number }
        | undefined;
      if (isNew && generation?.queued) {
        const planName = String(saved.name ?? "");
        const planTitle = String(saved.plan_title ?? "");
        toast.info("Generating in the background", {
          description: `Recurring plan saved. Creating ${generation.expected_count ?? 0} flight schedule(s) for ${planTitle || planName}.`,
        });
        if (planName) {
          trackGeneration({
            planName,
            planTitle,
            expectedCount: generation.expected_count,
            onComplete: onSaved,
          });
        } else {
          onSaved?.();
        }
      } else {
        const sync = saved.schedule_sync as { updated_count?: number; skipped?: unknown[] } | undefined;
        if (sync?.updated_count) {
          const skipped = sync.skipped?.length ?? 0;
          toast.success(`Recurring plan updated — ${sync.updated_count} flight schedule(s) synced`, {
            description:
              skipped > 0
                ? `${skipped} schedule(s) could not be updated. Check error log for details.`
                : undefined,
          });
        } else {
          toast.success(form.name ? "Recurring plan updated" : "Recurring plan saved");
        }
        onSaved?.();
      }
      onOpenChange(false);
      setForm(emptyRecurringPlanForm);
      setPreviewCount(null);
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save plan");
    } finally {
      setSubmitting(false);
    }
  };

  const submitStatusLabel = submitting ? "Saving plan..." : null;

  const handleDialogOpenChange = (next: boolean) => {
    if (submitting && !next) return;
    onOpenChange(next);
  };

  return (
    <BilanFormDialog
      open={open}
      onOpenChange={handleDialogOpenChange}
      className="sm:max-w-5xl"
      bodyClassName="max-h-[80vh]"
      title={planName || form.name ? "Edit recurring plan" : "New recurring plan"}
      description="Step 2: bulk schedule rules. Saving a new plan creates dated flight schedules automatically."
      validationErrors={formAlerts.validationErrors}
      submitError={formAlerts.submitError}
      onDismissAlerts={formAlerts.clearAlerts}
      footer={
        <>
          <Button variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={loading || submitting}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handlePreview} disabled={loading || submitting}>
            Preview count
            {previewCount != null ? ` (${previewCount})` : ""}
          </Button>
          <Button
            className="bg-gold text-navy hover:bg-gold-dark"
            onClick={handleSave}
            disabled={loading || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {submitStatusLabel}
              </>
            ) : (
              "Save plan"
            )}
          </Button>
        </>
      }
    >
      <div className="relative min-h-[240px]">
        {submitting ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-background/85 px-6 text-center backdrop-blur-[1px]"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-9 w-9 animate-spin text-gold" />
            <p className="text-sm font-medium">{submitStatusLabel}</p>
          </div>
        ) : null}
        {loading ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <FormField label="Frequency" required fullWidth>
              <Select
                value={form.frequency}
                onValueChange={(v) =>
                  setForm({ ...form, frequency: v as RecurringPlanFormState["frequency"] })
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

            {form.frequency === "Weekly" ? (
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="mb-3 text-sm font-medium">Days of week</p>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {WEEKDAYS.map((d) => (
                    <div key={d.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`recurring-plan-${d.key}`}
                        checked={form[d.key]}
                        onCheckedChange={(checked) =>
                          setForm({ ...form, [d.key]: checked === true })
                        }
                      />
                      <Label htmlFor={`recurring-plan-${d.key}`} className="font-normal">
                        {d.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {form.frequency === "Monthly" ? (
              <FormField label="Day of month" required fullWidth>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.monthly_day}
                  onChange={(e) => setForm({ ...form, monthly_day: e.target.value })}
                />
              </FormField>
            ) : null}

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
              <FormField
                label="Flight setup"
              >
                <SearchableSelect
                  value={form.flight_number}
                  onValueChange={applyFlightSetupSelection}
                  options={flightSetupOptions}
                  placeholder="Select flight setup..."
                  emptyMessage={
                    flightSetupsLoading
                      ? "Loading flight setups..."
                      : "No flight setup records — create one under Flights → Flight setup"
                  }
                  isLoading={flightSetupsLoading}
                  clearable
                />
              </FormField>
              <FormField label="From → To">
                <Input
                  readOnly
                  value={selectedRouteLabel || "—"}
                  className="bg-muted/50"
                />
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
              <FormField label="Route" required>
                <SearchableSelect
                  value={form.route}
                  onValueChange={(v) => setForm({ ...form, route: v })}
                  options={routes}
                  placeholder="Select route"
                  disabled={!!form.flight_number}
                />
              </FormField>
              <FormField label="Airplane" required>
                <SearchableSelect
                  value={form.airplane}
                  onValueChange={(v) => {
                    setForm({ ...form, airplane: v });
                    if (useAirplaneSeats) void applyAirplaneSeatClasses(v, true);
                  }}
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
              <FormField label="Captain">
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
              <FormField label="First officer">
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

            <FormSection title="Seat capacity by class" className="mt-6">
              <p className="text-xs text-muted-foreground">
                {useAirplaneSeats
                  ? "Seats = total class capacity on generated flights. Reserve = held back from sale initially (Unreleased); release them later from seat inventory."
                  : "Seats = total inventory for this class on generated flights. Reserve = how many stay Unreleased until you release them from seat inventory."}
              </p>
              <div className="mt-3 rounded-md border">
                {useAirplaneSeats && (seatClassesLoading || layoutCapsLoading) ? (
                  <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {layoutCapsLoading ? "Loading airplane layout..." : "Loading seat classes..."}
                  </div>
                ) : !useAirplaneSeats && seatClassesLoading ? (
                  <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading seat classes...
                  </div>
                ) : displaySeatClassOptions.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    {useAirplaneSeats
                      ? form.airplane
                        ? "No seat classes found on this airplane. Add rows under Master → Airplanes → seat configuration (seat class, rows, columns)."
                        : "Select an airplane to load seat classes from its layout."
                      : "No active fare classes found. Add them under Master → Seat classes."}
                  </p>
                ) : (
                  <>
                    <div className="hidden border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_100px_100px] sm:gap-3">
                      <span>Class</span>
                      <span className="text-center">Seats</span>
                      <span className="text-center">Reserve</span>
                    </div>
                    <div className="divide-y">
                      {displaySeatClassOptions.map((opt) => {
                        const cap = useAirplaneSeats ? layoutCapsByClass[opt.value] : undefined;
                        const seats = seatQuotaForClass(form.seat_classes, opt.value);
                        const reserved = seatReservedForClass(form.seat_classes, opt.value);
                        const seatsNum = parseInt(seats, 10) || 0;
                        const available = Math.max(seatsNum - (parseInt(reserved, 10) || 0), 0);
                        return (
                          <div
                            key={opt.value}
                            className="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_100px_100px]"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{opt.label}</p>
                              {opt.description ? (
                                <p className="text-xs text-muted-foreground">{opt.description}</p>
                              ) : null}
                              {useAirplaneSeats && cap != null && cap > 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  Airplane layout: {cap} seat{cap === 1 ? "" : "s"}
                                </p>
                              ) : null}
                              {seatsNum > 0 ? (
                                <p className="text-xs text-emerald-700">
                                  {available} for sale · {parseInt(reserved, 10) || 0} reserved
                                </p>
                              ) : null}
                            </div>
                            <Input
                              type="number"
                              min={0}
                              max={cap || undefined}
                              value={seats}
                              onChange={(e) => setSeatClassQuota(opt.value, e.target.value)}
                              aria-label={`Total seats for ${opt.label}`}
                              className="h-9"
                            />
                            <Input
                              type="number"
                              min={0}
                              max={seatsNum || undefined}
                              value={reserved}
                              onChange={(e) => setSeatClassReserved(opt.value, e.target.value)}
                              aria-label={`Reserved seats for ${opt.label}`}
                              className="h-9"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              {displaySeatClassOptions.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Total seats:{" "}
                  {mergeSeatClassGrid(displaySeatClassOptions, form.seat_classes).reduce(
                    (sum, row) => sum + (parseInt(row.number_of_seats, 10) || 0),
                    0,
                  )}
                  {" · "}
                  Reserved:{" "}
                  {mergeSeatClassGrid(displaySeatClassOptions, form.seat_classes).reduce(
                    (sum, row) => sum + (parseInt(row.reserved_seats, 10) || 0),
                    0,
                  )}
                  {" · "}
                  For sale:{" "}
                  {mergeSeatClassGrid(displaySeatClassOptions, form.seat_classes).reduce(
                    (sum, row) => {
                      const total = parseInt(row.number_of_seats, 10) || 0;
                      const reserved = parseInt(row.reserved_seats, 10) || 0;
                      return sum + Math.max(total - reserved, 0);
                    },
                    0,
                  )}
                </p>
              ) : null}
            </FormSection>
          </div>
        )}
      </div>
    </BilanFormDialog>
  );
}
