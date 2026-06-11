"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MoreHorizontal, Plane, Plus, Repeat } from "lucide-react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import {
  amendFlightSchedule,
  cancelFlightSchedule,
  deleteFlightSchedule,
  getScheduleCancellationPreview,
  type ScheduleCancellationPreview,
  estimateArrivalFromRoute,
  fetchFlightDetails,
  getFlightSchedule,
  listSchedules,
  rescheduleFlight,
  saveSchedule,
  type FlightScheduleRow,
} from "@/services/flightSchedule";
import { ConfirmActionDialog } from "@/components/portal/confirm-action-dialog";
import { StatusBadge } from "@/components/portal/status-badge";
import { flightScheduleStatusStyle } from "@/lib/portal-status-styles";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/contexts/currency-context";
import {
  buildOverridePayload,
  overrideFormFromSchedule,
  emptyPassengerFaresForm,
  faresToForm,
  formatFaresSummary,
  overrideFormFromApi,
  PASSENGER_FARE_KEYS,
  PASSENGER_FARE_LABELS,
  parseBaseFaresInput,
  type PassengerBaseFaresForm,
} from "@/lib/passenger-base-fares";

const FLIGHT_STATUS_OPTIONS = [
  { value: "Scheduled", label: "Scheduled" },
  { value: "Delayed", label: "Delayed" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Departed", label: "Departed" },
  { value: "Arrived", label: "Arrived" },
];

const ALL_STATUSES_VALUE = "all";
const UPCOMING_STATUSES_VALUE = "upcoming";

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
  initial_seats_released: "",
};

type CrewOption = { name: string; full_name: string; crew_role: string };

type ScheduleFormState = typeof emptyScheduleForm;

function canCancelFlight(status: string) {
  return ["Scheduled", "Delayed"].includes(status);
}

function canAmendFlight(status: string) {
  return status === "Cancelled";
}

function canDeleteFlight(status: string) {
  return status === "Cancelled";
}

function canRescheduleFlight(status: string) {
  return ["Scheduled", "Delayed"].includes(status);
}

function canEditPrices(status: string) {
  return ["Scheduled", "Delayed"].includes(status);
}

function formatEstimateTime(time?: string) {
  if (!time) return "";
  return time.length >= 5 ? time.slice(0, 5) : time;
}

function PortalFlightsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatMoney } = useCurrency();
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES_VALUE);

  useEffect(() => {
    if (searchParams.get("view") === "upcoming") {
      setStatusFilter(UPCOMING_STATUSES_VALUE);
    }
    const status = searchParams.get("status");
    if (status) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  const fetchSchedules = useCallback(
    async (search: string) => {
      const res = await listSchedules({
        limit: 100,
        search: search.trim() || undefined,
        status:
          statusFilter === ALL_STATUSES_VALUE || statusFilter === UPCOMING_STATUSES_VALUE
            ? undefined
            : statusFilter,
        upcoming: statusFilter === UPCOMING_STATUSES_VALUE,
      });
      return res.data;
    },
    [statusFilter],
  );
  const {
    search: searchQuery,
    setSearch: setSearchQuery,
    rows,
    loading,
    error,
    refresh,
  } = useLiveListQuery<FlightScheduleRow>(fetchSchedules, { reloadKey: statusFilter });
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyScheduleForm);
  const [arrivalTouched, setArrivalTouched] = useState(false);
  const [amendArrivalTouched, setAmendArrivalTouched] = useState(true);
  const formAlerts = useFormDialogAlerts();

  const handleAddDialogOpenChange = (next: boolean) => {
    setAddOpen(next);
    if (!next) {
      formAlerts.clearAlerts();
      setForm(emptyScheduleForm);
      setFareOverrideForm(emptyPassengerFaresForm());
      setArrivalTouched(false);
    }
  };
  const [routes, setRoutes] = useState<
    {
      name: string;
      route_name?: string;
      base_fares?: { adult?: number; child?: number; infant?: number };
      base_fare?: number;
      origin_airport_label?: string;
      destination_airport_label?: string;
    }[]
  >([]);
  const [fareOverrideForm, setFareOverrideForm] = useState<PassengerBaseFaresForm>(
    emptyPassengerFaresForm(),
  );
  const [editPricesTarget, setEditPricesTarget] = useState<FlightScheduleRow | null>(null);
  const [editRouteBaseFares, setEditRouteBaseFares] = useState<{
    adult: number;
    child: number;
    infant: number;
  } | null>(null);
  const [editPricesLoading, setEditPricesLoading] = useState(false);
  const editPricesAlerts = useFormDialogAlerts();
  const [airplanes, setAirplanes] = useState<{ name: string; registration_number: string }[]>([]);
  const [pilotRoles, setPilotRoles] = useState<{ name: string; role_name: string }[]>([]);
  const [captains, setCaptains] = useState<CrewOption[]>([]);
  const [firstOfficers, setFirstOfficers] = useState<CrewOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, string> | null>(null);
  const [scheduleSummary, setScheduleSummary] = useState<Awaited<
    ReturnType<typeof getFlightSchedule>
  > | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FlightScheduleRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<FlightScheduleRow | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    reschedule_reason: "",
    new_departure_date: "",
    new_departure_time: "",
    new_arrival_date: "",
    new_arrival_time: "",
  });
  const rescheduleAlerts = useFormDialogAlerts();
  const [cancelTarget, setCancelTarget] = useState<FlightScheduleRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelPreview, setCancelPreview] = useState<ScheduleCancellationPreview | null>(null);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [refundAmount, setRefundAmount] = useState("");
  const cancelAlerts = useFormDialogAlerts();
  const [amendTarget, setAmendTarget] = useState<FlightScheduleRow | null>(null);
  const [amendForm, setAmendForm] = useState<ScheduleFormState>(emptyScheduleForm);
  const [amendLoading, setAmendLoading] = useState(false);
  const amendAlerts = useFormDialogAlerts();

  const openOfficeBooking = (scheduleId: string) => {
    router.push(`/portal/booking/new/seats?schedule=${encodeURIComponent(scheduleId)}`);
  };

  const openSeatInventory = (scheduleId: string) => {
    router.push(`/portal/seat-inventory?schedule=${encodeURIComponent(scheduleId)}`);
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

  const handleCancelDialogOpenChange = (open: boolean) => {
    if (!open) {
      setCancelTarget(null);
      setCancelReason("");
      setCancelPreview(null);
      setRefundType("full");
      setRefundAmount("");
      cancelAlerts.clearAlerts();
    }
  };

  const openCancel = (s: FlightScheduleRow) => {
    cancelAlerts.clearAlerts();
    setCancelReason("");
    setCancelPreview(null);
    setRefundType("full");
    setRefundAmount("");
    setCancelTarget(s);
    setCancelPreviewLoading(true);
    getScheduleCancellationPreview(s.name)
      .then(setCancelPreview)
      .catch((e) => {
        cancelAlerts.setSubmitError(
          e instanceof Error ? e.message : "Could not load booking summary",
        );
      })
      .finally(() => setCancelPreviewLoading(false));
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFlightSchedule(deleteTarget.name);
      toast.success(`Flight schedule ${deleteTarget.name} deleted`);
      if (selectedId === deleteTarget.name) setSelectedId(null);
      setDeleteTarget(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete flight schedule");
    } finally {
      setDeleting(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (!reason) {
      cancelAlerts.showValidation(["Cancellation reason"]);
      return;
    }
    const paidCount = cancelPreview?.paid_bookings_count ?? 0;
    if (paidCount > 0 && refundType === "partial") {
      const amount = Number(refundAmount);
      if (!refundAmount.trim() || Number.isNaN(amount) || amount <= 0) {
        cancelAlerts.showValidation(["Refund amount per booking"]);
        return;
      }
    }
    cancelAlerts.clearAlerts();
    try {
      const result = await cancelFlightSchedule(cancelTarget.name, reason, {
        ...(paidCount > 0
          ? {
              refund_type: refundType,
              refund_amount:
                refundType === "partial" ? Number(refundAmount) : undefined,
            }
          : {}),
      });
      const refundNote =
        result.refunds && result.refunds.length > 0
          ? ` · ${result.refunds.length} return invoice(s) created`
          : "";
      toast.success(`Flight ${cancelTarget.flight_number} cancelled${refundNote}`);
      setCancelTarget(null);
      setCancelReason("");
      setCancelPreview(null);
      setRefundType("full");
      setRefundAmount("");
      if (selectedId === cancelTarget.name) setSelectedId(null);
      refresh();
    } catch (e) {
      cancelAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to cancel flight");
    }
  };

  const handleAmendDialogOpenChange = (open: boolean) => {
    if (!open) {
      setAmendTarget(null);
      setAmendForm(emptyScheduleForm);
      setFareOverrideForm(emptyPassengerFaresForm());
      setEditRouteBaseFares(null);
      setAmendArrivalTouched(true);
      amendAlerts.clearAlerts();
    }
  };

  const handleEditPricesDialogOpenChange = (open: boolean) => {
    if (!open) {
      setEditPricesTarget(null);
      setEditRouteBaseFares(null);
      setFareOverrideForm(emptyPassengerFaresForm());
      editPricesAlerts.clearAlerts();
    }
  };

  const openEditPrices = async (s: FlightScheduleRow) => {
    editPricesAlerts.clearAlerts();
    setEditPricesTarget(s);
    setEditPricesLoading(true);
    try {
      const doc = await getFlightSchedule(s.name);
      setEditRouteBaseFares(doc.route_base_fares ?? null);
      setFareOverrideForm(overrideFormFromSchedule(doc));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load pricing");
      setEditPricesTarget(null);
    } finally {
      setEditPricesLoading(false);
    }
  };

  const submitEditPrices = async () => {
    if (!editPricesTarget) return;
    editPricesAlerts.clearAlerts();
    const override = buildOverridePayload(fareOverrideForm);
    if (override === null && PASSENGER_FARE_KEYS.some((k) => fareOverrideForm[k].trim())) {
      editPricesAlerts.showValidation(["Base fare overrides"]);
      return;
    }
    try {
      await saveSchedule(
        { name: editPricesTarget.name, ...override },
        { submit: false },
      );
      toast.success(`Pricing updated for ${editPricesTarget.flight_number}`);
      setEditPricesTarget(null);
      setFareOverrideForm(emptyPassengerFaresForm());
      refresh();
      if (selectedId === editPricesTarget.name) {
        fetchFlightDetails(editPricesTarget.name).then(setDetail).catch(() => setDetail(null));
      }
    } catch (e) {
      editPricesAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to update pricing");
    }
  };

  const selectedRouteMeta = useMemo(() => {
    const routeName = editPricesTarget?.route || form.route || amendForm.route;
    return routes.find((r) => r.name === routeName);
  }, [routes, editPricesTarget, form.route, amendForm.route]);

  const routeBaseFaresForHint = useMemo(() => {
    if (editRouteBaseFares) return editRouteBaseFares;
    if (!selectedRouteMeta) return null;
    return parseBaseFaresInput(
      selectedRouteMeta.base_fares,
      Number(selectedRouteMeta.base_fare) || null,
    );
  }, [editRouteBaseFares, selectedRouteMeta]);

  const openAmend = async (s: FlightScheduleRow) => {
    amendAlerts.clearAlerts();
    setAmendTarget(s);
    setAmendLoading(true);
    try {
      const doc = await getFlightSchedule(s.name);
      setAmendForm({
        route: doc.route,
        airplane: doc.airplane,
        departure_date: doc.departure_date,
        departure_time: doc.departure_time,
        arrival_date: doc.arrival_date,
        arrival_time: doc.arrival_time,
        status: "Scheduled",
        captain: doc.captain,
        first_officer: doc.first_officer || "",
      });
      setFareOverrideForm(overrideFormFromSchedule(doc));
      setEditRouteBaseFares(doc.route_base_fares ?? null);
      setAmendArrivalTouched(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load schedule");
      setAmendTarget(null);
    } finally {
      setAmendLoading(false);
    }
  };

  useEffect(() => {
    if (!addOpen || arrivalTouched) return;
    if (!form.route || !form.departure_date || !form.departure_time) return;

    let cancelled = false;
    estimateArrivalFromRoute(form.route, form.departure_date, form.departure_time)
      .then((est) => {
        if (cancelled || (!est.arrival_date && !est.arrival_time)) return;
        setForm((prev) => ({
          ...prev,
          ...(est.arrival_date ? { arrival_date: est.arrival_date } : {}),
          ...(est.arrival_time ? { arrival_time: formatEstimateTime(est.arrival_time) } : {}),
        }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [addOpen, arrivalTouched, form.route, form.departure_date, form.departure_time]);

  useEffect(() => {
    if (!amendTarget || amendArrivalTouched || amendLoading) return;
    if (!amendForm.route || !amendForm.departure_date || !amendForm.departure_time) return;

    let cancelled = false;
    estimateArrivalFromRoute(amendForm.route, amendForm.departure_date, amendForm.departure_time)
      .then((est) => {
        if (cancelled || (!est.arrival_date && !est.arrival_time)) return;
        setAmendForm((prev) => ({
          ...prev,
          ...(est.arrival_date ? { arrival_date: est.arrival_date } : {}),
          ...(est.arrival_time ? { arrival_time: formatEstimateTime(est.arrival_time) } : {}),
        }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    amendTarget,
    amendArrivalTouched,
    amendLoading,
    amendForm.route,
    amendForm.departure_date,
    amendForm.departure_time,
  ]);

  const submitAmend = async () => {
    if (!amendTarget) return;
    const missing = getMissingRequired(amendForm, [
      { key: "route", label: "Route" },
      { key: "airplane", label: "Airplane" },
      { key: "departure_date", label: "Departure date" },
      { key: "departure_time", label: "Departure time" },
      { key: "arrival_date", label: "Arrival date" },
      { key: "arrival_time", label: "Arrival time" },
      { key: "captain", label: "Captain" },
      { key: "first_officer", label: "First officer" },
    ]);
    if (missing.length) {
      amendAlerts.showValidation(missing);
      return;
    }
    amendAlerts.clearAlerts();
    try {
      const payload: Record<string, unknown> = {
        route: amendForm.route,
        airplane: amendForm.airplane,
        departure_date: amendForm.departure_date,
        departure_time: amendForm.departure_time,
        arrival_date: amendForm.arrival_date,
        arrival_time: amendForm.arrival_time,
        captain: amendForm.captain,
        first_officer: amendForm.first_officer,
      };
      const fareOverride = buildOverridePayload(fareOverrideForm);
      if (fareOverride) Object.assign(payload, fareOverride);
      const created = await amendFlightSchedule(amendTarget.name, payload, { submit: true });
      const newName = typeof created.name === "string" ? created.name : "";
      const seats = created.seats_created ?? 0;
      toast.success(
        newName
          ? `Amended schedule published as ${newName}${seats ? ` (${seats} seats)` : ""}`
          : "Amended schedule published",
      );
      setAmendTarget(null);
      setAmendForm(emptyScheduleForm);
      amendAlerts.clearAlerts();
      refresh();
    } catch (e) {
      amendAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to amend schedule");
    }
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

  const crewDepartureDate = addOpen
    ? form.departure_date
    : amendTarget
      ? amendForm.departure_date
      : "";

  useEffect(() => {
    if (!addOpen && !amendTarget && !editPricesTarget) return;
    fetchAllRoutes().then(setRoutes);
    if (addOpen || amendTarget) {
      fetchAllAirplanes().then(setAirplanes);
      listCrewRoles("Pilot").then(setPilotRoles).catch(() => setPilotRoles([]));
    }
  }, [addOpen, amendTarget, editPricesTarget]);

  useEffect(() => {
    if ((!addOpen && !amendTarget) || !crewDepartureDate) {
      setCaptains([]);
      setFirstOfficers([]);
      return;
    }

    const captainRoleId = pilotRoles.find((r) => /captain/i.test(r.role_name))?.name;
    const firstOfficerRoleId = pilotRoles.find((r) =>
      /first\s*officer|co-?pilot|\bfo\b/i.test(r.role_name),
    )?.name;

    const loadCrew = async () => {
      const captainList = await listCrewMembers({
        crew_role: captainRoleId,
        capacity: "captain",
        for_date: crewDepartureDate,
      });

      const foList = await listCrewMembers({
        crew_role: firstOfficerRoleId,
        capacity: "first_officer",
        for_date: crewDepartureDate,
      });

      setCaptains(captainList);
      setFirstOfficers(foList);
    };

    loadCrew().catch(() => {
      setCaptains([]);
      setFirstOfficers([]);
    });
  }, [addOpen, amendTarget, crewDepartureDate, pilotRoles]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setScheduleSummary(null);
      return;
    }
    setDetailLoading(true);
    Promise.all([fetchFlightDetails(selectedId), getFlightSchedule(selectedId)])
      .then(([routeDetail, summary]) => {
        setDetail(routeDetail);
        setScheduleSummary(summary);
      })
      .catch(() => {
        setDetail(null);
        setScheduleSummary(null);
      })
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const selectedRow = rows.find((r) => r.name === selectedId);

  const routeLabelByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of routes) {
      const endpoints =
        r.origin_airport_label && r.destination_airport_label
          ? `${r.origin_airport_label} → ${r.destination_airport_label}`
          : null;
      map.set(r.name, endpoints || r.route_name || r.name);
    }
    return map;
  }, [routes]);

  const routeOptions = useMemo(
    () =>
      routes.map((r) => ({
        value: r.name,
        label: routeLabelByName.get(r.name) || r.route_name || r.name,
      })),
    [routes, routeLabelByName],
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

  const firstOfficerOptionsFor = useCallback(
    (captainId: string) =>
      firstOfficers
        .filter((c) => c.name !== captainId)
        .map((c) => ({
          value: c.name,
          label: c.full_name,
          description: c.crew_role,
        })),
    [firstOfficers],
  );

  const createFirstOfficerOptions = useMemo(
    () => firstOfficerOptionsFor(form.captain),
    [firstOfficerOptionsFor, form.captain],
  );

  const amendFirstOfficerOptions = useMemo(
    () => firstOfficerOptionsFor(amendForm.captain),
    [firstOfficerOptionsFor, amendForm.captain],
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
      { key: "first_officer", label: "First officer" },
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
        first_officer: form.first_officer,
      };
      if (form.initial_seats_released.trim()) {
        payload.initial_seats_released = parseInt(form.initial_seats_released, 10) || 0;
      }
      const fareOverride = buildOverridePayload(fareOverrideForm);
      if (fareOverride) Object.assign(payload, fareOverride);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center justify-between gap-3 sm:block">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Flight schedule</h1>
            <p className="hidden text-muted-foreground sm:block">
              View, create, and manage departures
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            className="shrink-0 bg-gold text-navy hover:bg-gold-dark sm:hidden"
            aria-label="New schedule"
            onClick={() => {
              formAlerts.clearAlerts();
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Button
            asChild
            className="h-10 w-full bg-gold text-navy hover:bg-gold-dark sm:hidden"
          >
            <Link
              href="/portal/flights/recurring"
              className="inline-flex items-center justify-center"
            >
              <Repeat className="mr-2 h-4 w-4 shrink-0" />
              Recurring
            </Link>
          </Button>
          <Button variant="outline" asChild className="hidden h-10 sm:inline-flex">
            <Link
              href="/portal/flights/recurring"
              className="inline-flex items-center justify-center"
            >
              <Repeat className="mr-2 h-4 w-4 shrink-0" />
              Recurring (daily / weekly / monthly)
            </Link>
          </Button>
          <PortalAddButton
            className="hidden h-10 sm:inline-flex"
            onClick={() => {
              formAlerts.clearAlerts();
              setAddOpen(true);
            }}
          >
            New schedule
          </PortalAddButton>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-gold" />
              All departures
            </CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <label htmlFor="flight-status-filter" className="text-sm font-medium text-muted-foreground shrink-0">
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="flight-status-filter" className="w-full sm:w-[180px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STATUSES_VALUE}>All statuses</SelectItem>
                    <SelectItem value={UPCOMING_STATUSES_VALUE}>Upcoming</SelectItem>
                    {FLIGHT_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ListSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search flight no. or ID..."
                className="w-full sm:max-w-sm"
              />
            </div>
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
                        {searchQuery.trim() || statusFilter !== ALL_STATUSES_VALUE
                          ? "No flights match your filters."
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
                      <TableCell>{s.route_label || routeLabelByName.get(s.route) || s.route}</TableCell>
                      <TableCell>
                        {s.departure_date} {s.departure_time}
                      </TableCell>
                      <TableCell>{s.airplane}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={s.status}
                          kind="flight_schedule"
                          onFilter={(value) => setStatusFilter(value)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <ListRowActions doctype="Flight Schedule" docName={s.name}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEditPrices(s.status) && (
                                <DropdownMenuItem onClick={() => openEditPrices(s)}>
                                  Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => openSeatInventory(s.name)}>
                                View seat map
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openOfficeBooking(s.name)}
                                disabled={!canRescheduleFlight(s.status)}
                              >
                                Book flight
                              </DropdownMenuItem>
                              {canRescheduleFlight(s.status) && (
                                <DropdownMenuItem onClick={() => openReschedule(s)}>
                                  Reschedule
                                </DropdownMenuItem>
                              )}
                              {canCancelFlight(s.status) && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => openCancel(s)}
                                >
                                  Cancel flight schedule
                                </DropdownMenuItem>
                              )}
                              {canAmendFlight(s.status) && (
                                <DropdownMenuItem onClick={() => openAmend(s)}>
                                  Amend schedule
                                </DropdownMenuItem>
                              )}
                              {canDeleteFlight(s.status) && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteTarget(s)}
                                >
                                  Delete schedule
                                </DropdownMenuItem>
                              )}
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
            <FormField label="Arrival date" required hint="Estimated from route; you can override">
              <Input
                type="date"
                value={form.arrival_date}
                onChange={(e) => {
                  setArrivalTouched(true);
                  setForm({ ...form, arrival_date: e.target.value });
                }}
              />
            </FormField>
            <FormField label="Arrival time" required hint="Estimated from route; you can override">
              <Input
                type="time"
                value={form.arrival_time}
                onChange={(e) => {
                  setArrivalTouched(true);
                  setForm({ ...form, arrival_time: e.target.value });
                }}
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
            <FormField label="First officer" required>
              <SearchableSelect
                options={createFirstOfficerOptions}
                value={form.first_officer}
                onValueChange={(v) => setForm({ ...form, first_officer: v })}
                disabled={!form.departure_date}
                placeholder={
                  form.departure_date ? "Search first officer..." : "Set departure date first"
                }
                emptyMessage="No first officer found"
                clearable={false}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Seat release" className="mt-4">
          <FormGrid>
            <FormField
              label="Initial seats released"
              fullWidth
              hint="0 = release all aircraft seats. Enter 50 if only 50 of 100 should be bookable now; release the rest later from the flight detail."
            >
              <Input
                type="number"
                min={0}
                value={form.initial_seats_released}
                onChange={(e) =>
                  setForm({ ...form, initial_seats_released: e.target.value })
                }
                placeholder="0 = all seats"
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Pricing overrides (optional)" className="mt-4">
          {routeBaseFaresForHint && (
            <p className="text-xs text-muted-foreground -mt-1 mb-2">
              Route defaults: {formatFaresSummary(routeBaseFaresForHint, formatMoney)}
            </p>
          )}
          <FormGrid>
            {PASSENGER_FARE_KEYS.map((key) => (
              <FormField
                key={key}
                label={`${PASSENGER_FARE_LABELS[key]} override`}
                hint="Empty = use route fare"
              >
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={fareOverrideForm[key]}
                  onChange={(e) =>
                    setFareOverrideForm({ ...fareOverrideForm, [key]: e.target.value })
                  }
                  placeholder={
                    routeBaseFaresForHint?.[key] != null
                      ? formatMoney(routeBaseFaresForHint[key])
                      : undefined
                  }
                />
              </FormField>
            ))}
          </FormGrid>
        </FormSection>
      </BilanFormDialog>

      <BilanFormDialog
        open={!!editPricesTarget}
        onOpenChange={handleEditPricesDialogOpenChange}
        stackLevel={selectedId ? 1 : 0}
        title={`Edit pricing — ${editPricesTarget?.flight_number ?? ""}`}
        description={
          routeBaseFaresForHint
            ? `Route defaults: ${formatFaresSummary(routeBaseFaresForHint, formatMoney)}. Leave a field empty to use the route fare for that passenger type.`
            : "Set per-passenger base fare overrides for this flight, or leave empty to use route fares."
        }
        validationErrors={editPricesAlerts.validationErrors}
        submitError={editPricesAlerts.submitError}
        onDismissAlerts={editPricesAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditPricesTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold-dark"
              onClick={submitEditPrices}
              disabled={editPricesLoading}
            >
              Save pricing
            </Button>
          </>
        }
      >
        <FormGrid>
          {PASSENGER_FARE_KEYS.map((key) => (
            <FormField
              key={key}
              label={`${PASSENGER_FARE_LABELS[key]} base fare (economy)`}
              hint="Empty = use route fare for this type"
            >
              <Input
                type="number"
                min={0}
                step={0.01}
                value={fareOverrideForm[key]}
                onChange={(e) => {
                  setFareOverrideForm({ ...fareOverrideForm, [key]: e.target.value });
                  editPricesAlerts.clearAlerts();
                }}
                disabled={editPricesLoading}
                placeholder={
                  routeBaseFaresForHint?.[key] != null
                    ? formatMoney(routeBaseFaresForHint[key])
                    : undefined
                }
              />
            </FormField>
          ))}
        </FormGrid>
      </BilanFormDialog>

      <BilanFormDialog
        open={!!cancelTarget}
        onOpenChange={handleCancelDialogOpenChange}
        title={`Cancel ${cancelTarget?.flight_number ?? "flight schedule"}`}
        description="Cancels the flight, voids linked bookings, and creates return invoices for paid bookings."
        validationErrors={cancelAlerts.validationErrors}
        submitError={cancelAlerts.submitError}
        onDismissAlerts={cancelAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Back
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={submitCancel}
              disabled={!cancelReason.trim()}
            >
              Confirm cancellation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {cancelPreviewLoading ? (
            <p className="text-sm text-muted-foreground">Loading linked bookings…</p>
          ) : cancelPreview && cancelPreview.active_bookings_count > 0 ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p>
                <strong>{cancelPreview.active_bookings_count}</strong> active booking(s) will be
                cancelled
                {cancelPreview.paid_bookings_count > 0 ? (
                  <>
                    {" "}
                    — <strong>{cancelPreview.paid_bookings_count}</strong> paid (
                    {formatMoney(cancelPreview.total_paid_fare)} total fare)
                  </>
                ) : null}
                {cancelPreview.unpaid_bookings_count > 0 ? (
                  <>
                    {" "}
                    · <strong>{cancelPreview.unpaid_bookings_count}</strong> unpaid (no refund)
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active bookings on this flight.</p>
          )}

          {(cancelPreview?.paid_bookings_count ?? 0) > 0 && (
            <div className="space-y-3 rounded-lg border p-3">
              <Label>Refund for paid bookings</Label>
              <RadioGroup
                value={refundType}
                onValueChange={(v) => {
                  setRefundType(v as "full" | "partial");
                  cancelAlerts.clearAlerts();
                }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="full" id="refund-full" />
                  <Label htmlFor="refund-full" className="font-normal">
                    Full refund — return invoice for the full paid amount per booking
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="partial" id="refund-partial" />
                  <Label htmlFor="refund-partial" className="font-normal">
                    Partial refund — return invoice for a fixed amount per booking
                  </Label>
                </div>
              </RadioGroup>
              {refundType === "partial" && (
                <FormField label="Refund amount per booking" required>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={refundAmount}
                    onChange={(e) => {
                      setRefundAmount(e.target.value);
                      cancelAlerts.clearAlerts();
                    }}
                    placeholder="Amount to credit back on each return invoice"
                  />
                </FormField>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="flight-cancel-reason" className="text-sm font-medium leading-none">
              Cancellation reason
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Saved on the flight cancellation and each voided booking.
            </p>
            <Textarea
              id="flight-cancel-reason"
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
                cancelAlerts.clearAlerts();
              }}
              placeholder="Why is this flight being cancelled?"
              rows={4}
              className="min-h-[96px] resize-y"
            />
          </div>
        </div>
      </BilanFormDialog>

      <BilanFormDialog
        open={!!amendTarget}
        onOpenChange={handleAmendDialogOpenChange}
        className="sm:max-w-2xl"
        title={`Amend ${amendTarget?.flight_number ?? "flight schedule"}`}
        description="Creates a new published schedule from this cancelled flight. A new flight number is generated automatically."
        validationErrors={amendAlerts.validationErrors}
        submitError={amendAlerts.submitError}
        onDismissAlerts={amendAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setAmendTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold-dark"
              onClick={submitAmend}
              disabled={amendLoading}
            >
              {amendLoading ? "Loading…" : "Publish amended schedule"}
            </Button>
          </>
        }
      >
        {amendLoading ? (
          <p className="text-sm text-muted-foreground">Loading schedule…</p>
        ) : (
          <>
            <FormSection title="Flight">
              <FormGrid>
                <FormField label="Route" required fullWidth>
                  <SearchableSelect
                    options={routeOptions}
                    value={amendForm.route}
                    onValueChange={(v) => {
                      setAmendArrivalTouched(false);
                      setAmendForm({ ...amendForm, route: v });
                    }}
                    placeholder="Search route..."
                    emptyMessage="No route found"
                    clearable={false}
                  />
                </FormField>
                <FormField label="Airplane" required>
                  <SearchableSelect
                    options={airplaneOptions}
                    value={amendForm.airplane}
                    onValueChange={(v) => setAmendForm({ ...amendForm, airplane: v })}
                    valueLabel={amendForm.airplane}
                    placeholder="Search by ID or registration..."
                    emptyMessage="No aircraft found"
                    clearable={false}
                  />
                </FormField>
                <FormField label="Departure date" required>
                  <Input
                    type="date"
                    value={amendForm.departure_date}
                    onChange={(e) => {
                      setAmendArrivalTouched(false);
                      setAmendForm({
                        ...amendForm,
                        departure_date: e.target.value,
                        captain: "",
                        first_officer: "",
                      });
                    }}
                  />
                </FormField>
                <FormField label="Departure time" required>
                  <Input
                    type="time"
                    value={amendForm.departure_time}
                    onChange={(e) => {
                      setAmendArrivalTouched(false);
                      setAmendForm({ ...amendForm, departure_time: e.target.value });
                    }}
                  />
                </FormField>
                <FormField label="Arrival date" required hint="Estimated from route; you can override">
                  <Input
                    type="date"
                    value={amendForm.arrival_date}
                    onChange={(e) => {
                      setAmendArrivalTouched(true);
                      setAmendForm({ ...amendForm, arrival_date: e.target.value });
                    }}
                  />
                </FormField>
                <FormField label="Arrival time" required hint="Estimated from route; you can override">
                  <Input
                    type="time"
                    value={amendForm.arrival_time}
                    onChange={(e) => {
                      setAmendArrivalTouched(true);
                      setAmendForm({ ...amendForm, arrival_time: e.target.value });
                    }}
                  />
                </FormField>
              </FormGrid>
            </FormSection>
            <FormSection title="Crew" className="mt-4">
              <FormGrid className="grid-cols-2">
                <FormField label="Captain" required>
                  <SearchableSelect
                    options={captainOptions}
                    value={amendForm.captain}
                    onValueChange={(v) =>
                      setAmendForm({
                        ...amendForm,
                        captain: v,
                        first_officer:
                          v && amendForm.first_officer === v ? "" : amendForm.first_officer,
                      })
                    }
                    disabled={!amendForm.departure_date}
                    placeholder={
                      amendForm.departure_date ? "Search captain..." : "Set departure date first"
                    }
                    emptyMessage="No captain found"
                    clearable={false}
                  />
                </FormField>
                <FormField label="First officer" required>
                  <SearchableSelect
                    options={amendFirstOfficerOptions}
                    value={amendForm.first_officer}
                    onValueChange={(v) => setAmendForm({ ...amendForm, first_officer: v })}
                    disabled={!amendForm.departure_date}
                    placeholder={
                      amendForm.departure_date
                        ? "Search first officer..."
                        : "Set departure date first"
                    }
                    emptyMessage="No first officer found"
                    clearable={false}
                  />
                </FormField>
              </FormGrid>
            </FormSection>
            <FormSection title="Pricing overrides (optional)" className="mt-4">
              {routeBaseFaresForHint && (
                <p className="text-xs text-muted-foreground -mt-1 mb-2">
                  Route defaults: {formatFaresSummary(routeBaseFaresForHint, formatMoney)}
                </p>
              )}
              <FormGrid>
                {PASSENGER_FARE_KEYS.map((key) => (
                  <FormField key={key} label={`${PASSENGER_FARE_LABELS[key]} override`}>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={fareOverrideForm[key]}
                      onChange={(e) =>
                        setFareOverrideForm({ ...fareOverrideForm, [key]: e.target.value })
                      }
                      placeholder={
                        routeBaseFaresForHint?.[key] != null
                          ? formatMoney(routeBaseFaresForHint[key])
                          : undefined
                      }
                    />
                  </FormField>
                ))}
              </FormGrid>
            </FormSection>
          </>
        )}
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
        badge={
          selectedRow
            ? {
                label: flightScheduleStatusStyle(selectedRow.status).label,
                variant: "outline",
                className: flightScheduleStatusStyle(selectedRow.status).className,
              }
            : undefined
        }
        isLoading={detailLoading}
        footer={
          selectedRow ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
              {canAmendFlight(selectedRow.status) ? (
                <>
                  <Button
                    className="bg-gold text-navy hover:bg-gold-dark flex-1 min-w-[140px]"
                    onClick={() => openAmend(selectedRow)}
                  >
                    Amend schedule
                  </Button>
                  {canDeleteFlight(selectedRow.status) && (
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[140px] border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteTarget(selectedRow)}
                    >
                      Delete schedule
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {canEditPrices(selectedRow.status) && (
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[140px]"
                      onClick={() => openEditPrices(selectedRow)}
                    >
                      Edit pricing
                    </Button>
                  )}
                  <Button
                    className="bg-gold text-navy hover:bg-gold-dark flex-1 min-w-[140px]"
                    onClick={() => openOfficeBooking(selectedRow.name)}
                    disabled={!canRescheduleFlight(selectedRow.status)}
                  >
                    Book flight
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 min-w-[140px]"
                    onClick={() => openSeatInventory(selectedRow.name)}
                  >
                    View seat map
                  </Button>
                  {canRescheduleFlight(selectedRow.status) && (
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[140px]"
                      onClick={() => openReschedule(selectedRow)}
                    >
                      Reschedule
                    </Button>
                  )}
                  {canCancelFlight(selectedRow.status) && (
                    <Button
                      className="flex-1 min-w-[140px] bg-red-600 text-white hover:bg-red-500"
                      onClick={() => openCancel(selectedRow)}
                    >
                      Cancel schedule
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : undefined
        }
      >
        {selectedRow && (
          <>
            <DetailSection title="Schedule">
              <DetailRow label="ID" value={selectedRow.name} />
              <DetailRow
                label="Route"
                value={selectedRow.route_label || routeLabelByName.get(selectedRow.route) || selectedRow.route}
              />
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
            {scheduleSummary?.base_fares && (
              <DetailSection title="Current fares (economy)">
                <DetailRow
                  label="Adult / Child / Infant"
                  value={formatFaresSummary(scheduleSummary.base_fares, formatMoney)}
                />
              </DetailSection>
            )}
            {scheduleSummary?.fare_history && scheduleSummary.fare_history.length > 0 && (
              <DetailSection title="Fare change history">
                <div className="space-y-2 text-sm">
                  {scheduleSummary.fare_history.map((row, index) => (
                    <div
                      key={`${row.changed_at}-${index}`}
                      className="rounded-md border border-border/60 px-3 py-2"
                    >
                      <p className="text-xs text-muted-foreground">
                        {row.changed_at || "—"}
                        {row.changed_by ? ` · ${row.changed_by}` : ""}
                      </p>
                      <p className="mt-1 font-medium">
                        Was: Adult {formatMoney(row.previous_adult ?? 0)} · Child{" "}
                        {formatMoney(row.previous_child ?? 0)} · Infant{" "}
                        {formatMoney(row.previous_infant ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              </DetailSection>
            )}
          </>
        )}
      </DetailSheet>

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.flight_number ?? "flight schedule"}?`}
        description="This permanently removes the cancelled schedule. This cannot be undone."
        confirmLabel="Delete schedule"
        tone="destructive"
        loading={deleting}
        onConfirm={submitDelete}
      />
    </div>
  );
}

export default function PortalFlightsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <PortalFlightsPageContent />
    </Suspense>
  );
}
