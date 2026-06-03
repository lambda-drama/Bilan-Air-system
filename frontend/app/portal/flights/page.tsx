"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Plane } from "lucide-react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import {
  fetchFlightDetails,
  listSchedules,
  rescheduleFlight,
  saveSchedule,
  type FlightScheduleRow,
} from "@/services/flightSchedule";
import { toast } from "sonner";
import { fetchAllRoutes } from "@/services/flightRoute";
import { fetchAllAirplanes } from "@/services/airplane";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import {
  BilanFormDialog,
  FormField,
  FormGrid,
  FormSection,
} from "@/components/portal/form-dialog";
import { listCrewMembers, listCrewRoles } from "@/services/lookups";
import { getMissingRequired } from "@/lib/validate-form";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { DocLink } from "@/components/portal/doc-link";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { ListSearch } from "@/components/portal/list-search";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { useRouter } from "next/navigation";

const FLIGHT_STATUS_OPTIONS = [
  { value: "Scheduled", label: "Scheduled" },
  { value: "Delayed", label: "Delayed" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Departed", label: "Departed" },
  { value: "Arrived", label: "Arrived" },
];

const emptyScheduleForm = {
  route: "",
  airplane: "",
  departure_date: "",
  departure_time: "",
  arrival_date: "",
  arrival_time: "",
  status: "Scheduled",
  captain: "",
  first_officer: "",
  base_fare_override: "",
};

type CrewOption = { name: string; full_name: string; crew_role: string };

export default function PortalFlightsPage() {
  const router = useRouter();
  const fetchSchedules = useCallback(async (search: string) => {
    const res = await listSchedules({ limit: 100, search: search.trim() || undefined });
    return res.data;
  }, []);
  const {
    search: searchQuery,
    setSearch: setSearchQuery,
    rows,
    loading,
    error,
    refresh,
  } = useLiveListQuery<FlightScheduleRow>(fetchSchedules);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyScheduleForm);
  const formAlerts = useFormDialogAlerts();

  const handleAddDialogOpenChange = (next: boolean) => {
    setAddOpen(next);
    if (!next) {
      formAlerts.clearAlerts();
      setForm(emptyScheduleForm);
    }
  };
  const [routes, setRoutes] = useState<{ name: string; route_name?: string }[]>([]);
  const [airplanes, setAirplanes] = useState<{ name: string; registration_number: string }[]>([]);
  const [pilotRoles, setPilotRoles] = useState<{ name: string; role_name: string }[]>([]);
  const [captains, setCaptains] = useState<CrewOption[]>([]);
  const [firstOfficers, setFirstOfficers] = useState<CrewOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, string> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<FlightScheduleRow | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    reschedule_reason: "",
    new_departure_date: "",
    new_departure_time: "",
    new_arrival_date: "",
    new_arrival_time: "",
  });
  const rescheduleAlerts = useFormDialogAlerts();

  const openOfficeBooking = (scheduleId: string) => {
    router.push(`/portal/booking/new/seats?schedule=${encodeURIComponent(scheduleId)}`);
  };

  const handleRescheduleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setRescheduleTarget(null);
      rescheduleAlerts.clearAlerts();
    }
  };

  const openReschedule = (s: FlightScheduleRow) => {
    rescheduleAlerts.clearAlerts();
    setRescheduleTarget(s);
    setRescheduleForm({
      reschedule_reason: "",
      new_departure_date: s.departure_date,
      new_departure_time: s.departure_time,
      new_arrival_date: s.arrival_date,
      new_arrival_time: s.arrival_time,
    });
  };

  const submitReschedule = async () => {
    if (!rescheduleTarget) return;

    const missing = getMissingRequired(rescheduleForm, [
      { key: "reschedule_reason", label: "Reason" },
      { key: "new_departure_date", label: "New departure date" },
      { key: "new_departure_time", label: "New departure time" },
      { key: "new_arrival_date", label: "New arrival date" },
      { key: "new_arrival_time", label: "New arrival time" },
    ]);
    if (missing.length) {
      rescheduleAlerts.showValidation(missing);
      return;
    }

    rescheduleAlerts.clearAlerts();
    try {
      await rescheduleFlight({
        schedule_name: rescheduleTarget.name,
        ...rescheduleForm,
      });
      setRescheduleTarget(null);
      rescheduleAlerts.clearAlerts();
      refresh();
    } catch (e) {
      rescheduleAlerts.setSubmitError(e instanceof Error ? e.message : "Reschedule failed");
    }
  };

  useEffect(() => {
    if (!addOpen) return;
    fetchAllRoutes().then(setRoutes);
    fetchAllAirplanes().then(setAirplanes);
    listCrewRoles("Pilot").then(setPilotRoles).catch(() => setPilotRoles([]));
  }, [addOpen]);

  useEffect(() => {
    if (!addOpen || !form.departure_date) {
      setCaptains([]);
      setFirstOfficers([]);
      return;
    }

    const captainRoleId = pilotRoles.find((r) => /captain/i.test(r.role_name))?.name;
    const firstOfficerRoleId = pilotRoles.find((r) =>
      /first\s*officer|co-?pilot|\bfo\b/i.test(r.role_name),
    )?.name;

    const loadCrew = async () => {
      const captainList = captainRoleId
        ? await listCrewMembers({ crew_role: captainRoleId, for_date: form.departure_date })
        : await listCrewMembers({ for_date: form.departure_date });

      let foList: CrewOption[];
      if (firstOfficerRoleId) {
        foList = await listCrewMembers({
          crew_role: firstOfficerRoleId,
          for_date: form.departure_date,
        });
      } else {
        const allOnDate = await listCrewMembers({ for_date: form.departure_date });
        foList = allOnDate.filter((c) => {
          if (captainRoleId && c.crew_role === captainRoleId) return false;
          return !/captain/i.test(c.crew_role || "");
        });
      }

      setCaptains(captainList);
      setFirstOfficers(foList);
    };

    loadCrew().catch(() => {
      setCaptains([]);
      setFirstOfficers([]);
    });
  }, [addOpen, form.departure_date, pilotRoles]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetchFlightDetails(selectedId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const selectedRow = rows.find((r) => r.name === selectedId);

  const routeOptions = useMemo(
    () =>
      routes.map((r) => ({
        value: r.name,
        label: r.route_name || r.name,
      })),
    [routes],
  );

  const airplaneOptions = useMemo(
    () =>
      airplanes.map((a) => ({
        value: a.name,
        label: a.name,
        description: [a.registration_number, a.aircraft_model].filter(Boolean).join(" · "),
      })),
    [airplanes],
  );

  const captainOptions = useMemo(
    () =>
      captains.map((c) => ({
        value: c.name,
        label: c.full_name,
        description: c.crew_role,
      })),
    [captains],
  );

  const firstOfficerOptions = useMemo(
    () =>
      firstOfficers
        .filter((c) => c.name !== form.captain)
        .map((c) => ({
          value: c.name,
          label: c.full_name,
          description: c.crew_role,
        })),
    [firstOfficers, form.captain],
  );

  const handleCreate = async () => {
    const missing = getMissingRequired(form, [
      { key: "route", label: "Route" },
      { key: "airplane", label: "Airplane" },
      { key: "departure_date", label: "Departure date" },
      { key: "departure_time", label: "Departure time" },
      { key: "arrival_date", label: "Arrival date" },
      { key: "arrival_time", label: "Arrival time" },
      { key: "status", label: "Status" },
      { key: "captain", label: "Captain" },
    ]);
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }

    formAlerts.clearAlerts();
    try {
      const payload: Record<string, unknown> = {
        route: form.route,
        airplane: form.airplane,
        departure_date: form.departure_date,
        departure_time: form.departure_time,
        arrival_date: form.arrival_date,
        arrival_time: form.arrival_time,
        status: form.status,
        captain: form.captain,
      };
      if (form.first_officer) payload.first_officer = form.first_officer;
      if (form.base_fare_override) {
        payload.base_fare_override = parseFloat(form.base_fare_override);
      }
      const created = await saveSchedule(payload, { submit: true });
      const seats = Number(created.seats_created ?? 0);
      const published = created.submitted !== false;
      if (seats > 0) {
        toast.success(
          published
            ? `Flight schedule published with ${seats} seats`
            : `Schedule saved (draft) with ${seats} seats`,
        );
      } else {
        toast.warning(
          published
            ? "Schedule published but no seats were created. Check the airplane seat configuration."
            : "Schedule saved but no seats were created. Check the airplane seat configuration.",
        );
      }
      setAddOpen(false);
      setForm(emptyScheduleForm);
      formAlerts.clearAlerts();
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to create schedule");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flight schedules</h1>
          <p className="text-muted-foreground">Schedules from the booking system</p>
        </div>
        <PortalAddButton
          onClick={() => {
            formAlerts.clearAlerts();
            setAddOpen(true);
          }}
        >
          New schedule
        </PortalAddButton>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-gold" />
              All flights
            </CardTitle>
            <ListSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search flight no. or ID..."
              className="max-w-xs sm:max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Flight</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead>Aircraft</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        {searchQuery.trim()
                          ? "No flights match your search."
                          : "No flight schedules yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                  rows.map((s) => (
                    <TableRow
                      key={s.name}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(s.name)}
                    >
                      <TableCell>
                        <DocLink onClick={() => setSelectedId(s.name)}>{s.name}</DocLink>
                      </TableCell>
                      <TableCell className="font-medium">{s.flight_number}</TableCell>
                      <TableCell>{s.route}</TableCell>
                      <TableCell>
                        {s.departure_date} {s.departure_time}
                      </TableCell>
                      <TableCell>{s.airplane}</TableCell>
                      <TableCell>{s.status}</TableCell>
                      <TableCell className="text-right">
                        <ListRowActions doctype="Flight Schedule" docName={s.name}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedId(s.name)}>
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openOfficeBooking(s.name)}
                                disabled={!["Scheduled", "Delayed"].includes(s.status)}
                              >
                                Book flight
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openReschedule(s)}>
                                Reschedule
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </ListRowActions>
                      </TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <BilanFormDialog
        open={addOpen}
        onOpenChange={handleAddDialogOpenChange}
        className="sm:max-w-2xl"
        title="New flight schedule"
        description="Flight number is generated automatically. Fields marked * are required."
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-gold text-navy hover:bg-gold-dark" onClick={handleCreate}>
              Create
            </Button>
          </>
        }
      >
        <FormSection title="Flight">
          <FormGrid>
            <FormField label="Route" required fullWidth>
              <SearchableSelect
                options={routeOptions}
                value={form.route}
                onValueChange={(v) => setForm({ ...form, route: v })}
                placeholder="Search route..."
                emptyMessage="No route found"
                clearable={false}
              />
            </FormField>
            <FormField label="Airplane" required>
              <SearchableSelect
                options={airplaneOptions}
                value={form.airplane}
                onValueChange={(v) => setForm({ ...form, airplane: v })}
                valueLabel={form.airplane}
                placeholder="Search by ID or registration..."
                emptyMessage="No aircraft found"
                clearable={false}
              />
            </FormField>
            <FormField label="Status" required>
              <SearchableSelect
                options={FLIGHT_STATUS_OPTIONS}
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
                placeholder="Search status..."
                clearable={false}
              />
            </FormField>
            <FormField label="Departure date" required>
              <Input
                type="date"
                value={form.departure_date}
                onChange={(e) =>
                  setForm({ ...form, departure_date: e.target.value, captain: "", first_officer: "" })
                }
              />
            </FormField>
            <FormField label="Departure time" required>
              <Input
                type="time"
                value={form.departure_time}
                onChange={(e) => setForm({ ...form, departure_time: e.target.value })}
              />
            </FormField>
            <FormField label="Arrival date" required>
              <Input
                type="date"
                value={form.arrival_date}
                onChange={(e) => setForm({ ...form, arrival_date: e.target.value })}
              />
            </FormField>
            <FormField label="Arrival time" required>
              <Input
                type="time"
                value={form.arrival_time}
                onChange={(e) => setForm({ ...form, arrival_time: e.target.value })}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Crew" className="mt-4">
          <FormGrid className="grid-cols-2">
            <FormField label="Captain" required>
              <SearchableSelect
                options={captainOptions}
                value={form.captain}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    captain: v,
                    first_officer: v && form.first_officer === v ? "" : form.first_officer,
                  })
                }
                disabled={!form.departure_date}
                placeholder={form.departure_date ? "Search captain..." : "Set departure date first"}
                emptyMessage="No captain found"
                clearable={false}
              />
            </FormField>
            <FormField label="First officer">
              <SearchableSelect
                options={firstOfficerOptions}
                value={form.first_officer}
                onValueChange={(v) => setForm({ ...form, first_officer: v })}
                disabled={!form.departure_date}
                placeholder={
                  form.departure_date ? "Search first officer (optional)..." : "Set departure date first"
                }
                emptyMessage="No first officer found"
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Pricing" className="mt-4">
          <FormField
            label="Base fare override"
            fullWidth
            hint="Leave empty to use the route base fare"
          >
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.base_fare_override}
              onChange={(e) => setForm({ ...form, base_fare_override: e.target.value })}
            />
          </FormField>
        </FormSection>
      </BilanFormDialog>

      <BilanFormDialog
        open={!!rescheduleTarget}
        onOpenChange={handleRescheduleDialogOpenChange}
        title={`Reschedule ${rescheduleTarget?.flight_number ?? ""}`}
        validationErrors={rescheduleAlerts.validationErrors}
        submitError={rescheduleAlerts.submitError}
        onDismissAlerts={rescheduleAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>
              Cancel
            </Button>
            <Button className="bg-gold text-navy hover:bg-gold-dark" onClick={submitReschedule}>
              Save reschedule
            </Button>
          </>
        }
      >
        <FormField label="Reason" required fullWidth>
          <Input
            value={rescheduleForm.reschedule_reason}
            onChange={(e) =>
              setRescheduleForm({ ...rescheduleForm, reschedule_reason: e.target.value })
            }
          />
        </FormField>
        <FormGrid className="mt-4">
          <FormField label="New departure date" required>
            <Input
              type="date"
              value={rescheduleForm.new_departure_date}
              onChange={(e) =>
                setRescheduleForm({ ...rescheduleForm, new_departure_date: e.target.value })
              }
            />
          </FormField>
          <FormField label="New departure time" required>
            <Input
              type="time"
              value={rescheduleForm.new_departure_time}
              onChange={(e) =>
                setRescheduleForm({ ...rescheduleForm, new_departure_time: e.target.value })
              }
            />
          </FormField>
          <FormField label="New arrival date" required>
            <Input
              type="date"
              value={rescheduleForm.new_arrival_date}
              onChange={(e) =>
                setRescheduleForm({ ...rescheduleForm, new_arrival_date: e.target.value })
              }
            />
          </FormField>
          <FormField label="New arrival time" required>
            <Input
              type="time"
              value={rescheduleForm.new_arrival_time}
              onChange={(e) =>
                setRescheduleForm({ ...rescheduleForm, new_arrival_time: e.target.value })
              }
            />
          </FormField>
        </FormGrid>
      </BilanFormDialog>

      <DetailSheet
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selectedRow?.flight_number || selectedId || ""}
        subtitle={selectedId || undefined}
        badge={selectedRow ? { label: selectedRow.status } : undefined}
        isLoading={detailLoading}
        footer={
          selectedRow ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                className="bg-gold text-navy hover:bg-gold-dark flex-1"
                onClick={() => openOfficeBooking(selectedRow.name)}
                disabled={!["Scheduled", "Delayed"].includes(selectedRow.status)}
              >
                Book flight
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => openReschedule(selectedRow)}
              >
                Reschedule
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedRow && (
          <>
            <DetailSection title="Schedule">
              <DetailRow label="ID" value={selectedRow.name} />
              <DetailRow label="Route" value={selectedRow.route} />
              <DetailRow label="Airplane" value={selectedRow.airplane} />
              <DetailRow
                label="Departure"
                value={`${selectedRow.departure_date} ${selectedRow.departure_time}`}
              />
              <DetailRow
                label="Arrival"
                value={`${selectedRow.arrival_date} ${selectedRow.arrival_time}`}
              />
            </DetailSection>
            {detail && (
              <DetailSection title="Route detail">
                <DetailRow label="Origin" value={detail.origin} />
                <DetailRow label="Destination" value={detail.destination} />
                <DetailRow label="Aircraft reg." value={detail.aircraft} />
                <DetailRow label="Model" value={detail.aircraft_model} />
              </DetailSection>
            )}
          </>
        )}
      </DetailSheet>
    </div>
  );
}
