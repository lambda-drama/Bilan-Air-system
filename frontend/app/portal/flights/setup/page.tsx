"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DollarSign, LayoutGrid, Pencil, Plane, Power, Scale, Trash2 } from "lucide-react";
import { ConfirmActionDialog } from "@/components/portal/confirm-action-dialog";
import { BilanFormDialog, FormField, FormGrid, FormSection } from "@/components/portal/form-dialog";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { DocLink } from "@/components/portal/doc-link";
import { ListSearch } from "@/components/portal/list-search";
import { PermissionGate } from "@/components/portal/permission-gate";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { RowActionMenu, RowActionMenuItem } from "@/components/portal/row-action-menu";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchAllRoutes } from "@/services/flightRoute";
import { fetchAllAirplanes } from "@/services/airplane";
import { listFlightSetups, type FlightSetupRow } from "@/services/flightSchedule";
import {
  deleteFlightSchedulePlan,
  listFlightSchedulePlans,
} from "@/services/flightSchedulePlan";
import {
  flightSetupPath,
  deleteFlightSetup,
  getFlightSetup,
  saveFlightSetup,
  setFlightSetupActive,
} from "@/services/flightSetup";
import { richTextToPlain } from "@/lib/rich-text";
import { toast } from "sonner";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const emptyForm = {
  flight_number: "",
  route: "",
  airplane: "",
  terms_and_conditions: "",
  is_active: true,
};

type FlightSetupDeleteTarget = {
  flight_number: string;
  plan_count?: number;
  schedule_count?: number;
};

function isFlightSetupActive(value?: number | boolean | null) {
  return value !== 0 && value !== false;
}

export default function FlightSetupPage() {
  const {
    search,
    setSearch,
    rows,
    loading,
    error,
    refresh,
  } = useLiveListQuery<FlightSetupRow>(
    (query) => listFlightSetups({ limit: 200, search: query.trim() || undefined }).then((r) => r.data),
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [isCreate, setIsCreate] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);
  const [routes, setRoutes] = useState<
    Array<{
      value: string;
      label: string;
      origin_label?: string;
      destination_label?: string;
    }>
  >([]);
  const [airplanes, setAirplanes] = useState<Array<{ value: string; label: string }>>([]);
  const [routeEndpoints, setRouteEndpoints] = useState({ origin: "", destination: "" });
  const [selectedFlightNumber, setSelectedFlightNumber] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getFlightSetup>> | null>(null);
  const [toggleLoadingFlightNumber, setToggleLoadingFlightNumber] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FlightSetupDeleteTarget | null>(null);
  const [deleteLinkedPlansOpen, setDeleteLinkedPlansOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const formAlerts = useFormDialogAlerts();

  const selectedRoute = routes.find((r) => r.value === editForm.route);
  const fromLabel = selectedRoute?.origin_label || routeEndpoints.origin;
  const toLabel = selectedRoute?.destination_label || routeEndpoints.destination;

  useEffect(() => {
    Promise.all([fetchAllRoutes(), fetchAllAirplanes()]).then(([r, a]) => {
      setRoutes(
        r.map((x) => ({
          value: x.name,
          label: x.route_name || x.name,
          origin_label: x.origin_airport_label,
          destination_label: x.destination_airport_label,
        })),
      );
      setAirplanes(
        a.map((x) => ({
          value: x.name,
          label: [x.registration_number, x.aircraft_model].filter(Boolean).join(" · ") || x.name,
        })),
      );
    });
  }, []);

  const openCreate = () => {
    formAlerts.clearAlerts();
    setIsCreate(true);
    setEditTarget(null);
    setEditForm(emptyForm);
    setRouteEndpoints({ origin: "", destination: "" });
    setEditOpen(true);
  };

  const openEdit = async (flightNumber: string) => {
    formAlerts.clearAlerts();
    setIsCreate(false);
    setEditTarget(flightNumber);
    setEditLoading(true);
    setEditOpen(true);
    try {
      const loaded = await getFlightSetup(flightNumber);
      setEditForm({
        flight_number: flightNumber,
        route: loaded.route || "",
        airplane: loaded.airplane || "",
        terms_and_conditions: richTextToPlain(loaded.terms_and_conditions),
        is_active: loaded.is_active !== 0 && loaded.is_active !== false,
      });
      setRouteEndpoints({
        origin: loaded.origin_label || "",
        destination: loaded.destination_label || "",
      });
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to load flight");
      setEditOpen(false);
    } finally {
      setEditLoading(false);
    }
  };

  const selectedRow = rows.find((r) => r.flight_number === selectedFlightNumber);
  const selectedIsActive = isFlightSetupActive(detail?.is_active ?? selectedRow?.is_active);

  useEffect(() => {
    if (!selectedFlightNumber) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    getFlightSetup(selectedFlightNumber)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedFlightNumber]);

  const saveForm = async () => {
    const flightNumber = (isCreate ? editForm.flight_number : editTarget)?.trim();
    if (!flightNumber) {
      formAlerts.showValidation(["Flight number"]);
      return;
    }
    if (!editForm.route || !editForm.airplane) {
      const missing: string[] = [];
      if (!editForm.route) missing.push("Route");
      if (!editForm.airplane) missing.push("Aircraft");
      formAlerts.showValidation(missing);
      return;
    }
    formAlerts.clearAlerts();
    setEditLoading(true);
    try {
      const saved = await saveFlightSetup({
        flight_number: flightNumber,
        route: editForm.route,
        airplane: editForm.airplane,
        terms_and_conditions: editForm.terms_and_conditions,
        is_active: editForm.is_active ? 1 : 0,
      });
      const cascade = saved.route_cascade;
      if (
        !isCreate &&
        cascade &&
        (cascade.updated_schedules > 0 || cascade.updated_plans > 0 || cascade.skipped_schedules > 0)
      ) {
        toast.success(
          `Flight ${flightNumber} updated · ${cascade.updated_schedules} schedule(s) and ${cascade.updated_plans} plan(s) got the new route` +
            (cascade.skipped_schedules
              ? ` (${cascade.skipped_schedules} skipped — past or has bookings)`
              : ""),
        );
      } else {
        toast.success(isCreate ? `Flight setup ${flightNumber} created` : `Flight ${flightNumber} updated`);
      }
      setEditOpen(false);
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleActive = async (flightNumber: string, currentActive: boolean) => {
    setToggleLoadingFlightNumber(flightNumber);
    try {
      const updated = await setFlightSetupActive(flightNumber, !currentActive);
      setDetail((prev) => (prev?.flight_number === flightNumber ? updated : prev));
      toast.success(
        !currentActive
          ? `Flight setup ${flightNumber} activated`
          : `Flight setup ${flightNumber} deactivated`,
      );
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update flight setup");
    } finally {
      setToggleLoadingFlightNumber(null);
    }
  };

  const resetDeleteFlow = () => {
    setDeleteLinkedPlansOpen(false);
    setDeleteTarget(null);
  };

  const deleteFlightSetupRecord = async (target: FlightSetupDeleteTarget) => {
    setDeleteLoading(true);
    try {
      await deleteFlightSetup(target.flight_number);
      toast.success(`Flight setup ${target.flight_number} deleted`);
      if (selectedFlightNumber === target.flight_number) {
        setSelectedFlightNumber(null);
        setDetail(null);
      }
      resetDeleteFlow();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete flight setup");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if ((deleteTarget.plan_count ?? 0) > 0) {
      setDeleteLinkedPlansOpen(true);
      return;
    }
    await deleteFlightSetupRecord(deleteTarget);
  };

  const handleDeleteLinkedPlansAndFlightSetup = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const plansRes = await listFlightSchedulePlans({
        flight_number: deleteTarget.flight_number,
        limit: 500,
      });
      let deletedPlanCount = 0;
      let deletedScheduleCount = 0;
      for (const plan of plansRes.data) {
        const result = await deleteFlightSchedulePlan(plan.name, {
          deleteSchedules: true,
        });
        deletedPlanCount += 1;
        deletedScheduleCount += result.deleted_schedules ?? 0;
      }
      await deleteFlightSetup(deleteTarget.flight_number);
      toast.success(
        `Flight setup ${deleteTarget.flight_number} deleted after removing ${deletedPlanCount} recurring plan(s)` +
          (deletedScheduleCount > 0
            ? ` and ${deletedScheduleCount} linked departure(s)`
            : ""),
      );
      if (selectedFlightNumber === deleteTarget.flight_number) {
        setSelectedFlightNumber(null);
        setDetail(null);
      }
      resetDeleteFlow();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete linked recurring plans");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flight setup</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <PortalAddButton onClick={openCreate} doctype="Flight Setup">New flight setup</PortalAddButton>
          <Button variant="outline" asChild>
            <Link href="/portal/flights">All departures</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-gold" />
              Flight numbers
            </CardTitle>
            <ListSearch
              value={search}
              onChange={setSearch}
              placeholder="Filter flight number..."
              className="w-full sm:max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flight number</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Aircraft</TableHead>
                    <TableHead>Recurring</TableHead>
                    <TableHead>Schedules</TableHead>
                    <TableHead>Next departure</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        {search.trim()
                          ? "No flight setup records match your filter."
                          : "No flight setup records yet. Click + New flight setup to add one."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow
                        key={row.flight_number}
                        className="cursor-pointer"
                        onClick={() => setSelectedFlightNumber(row.flight_number)}
                      >
                        <TableCell className="font-semibold">
                          <DocLink onClick={() => setSelectedFlightNumber(row.flight_number)}>
                            {row.flight_number}
                          </DocLink>
                        </TableCell>
                        <TableCell>{row.origin_label || "—"}</TableCell>
                        <TableCell>{row.destination_label || "—"}</TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {row.airplane_label || row.airplane || "—"}
                        </TableCell>
                        <TableCell>{row.plan_count ?? 0}</TableCell>
                        <TableCell>
                          <span className="font-medium">{row.schedule_count}</span>
                          {row.first_departure && row.last_departure ? (
                            <p className="text-xs text-muted-foreground">
                              {formatDate(row.first_departure)} – {formatDate(row.last_departure)}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {row.next_departure ? (
                            <>
                              {formatDate(row.next_departure)}
                              {row.next_departure_time ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  {row.next_departure_time.slice(0, 5)}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{row.updated_by || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(row.updated_on)}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActionMenu>
                            <RowActionMenuItem
                              icon={Pencil}
                              doctype="Flight Setup"
                              onClick={() => openEdit(row.flight_number)}
                            >
                              Edit flight setup
                            </RowActionMenuItem>
                            <RowActionMenuItem
                              icon={Power}
                              doctype="Flight Setup"
                              permission="write"
                              disabled={toggleLoadingFlightNumber === row.flight_number}
                              onClick={() =>
                                void handleToggleActive(
                                  row.flight_number,
                                  isFlightSetupActive(row.is_active),
                                )
                              }
                            >
                              {isFlightSetupActive(row.is_active) ? "Deactivate flight setup" : "Activate flight setup"}
                            </RowActionMenuItem>
                            <RowActionMenuItem
                              icon={DollarSign}
                              accent
                              href={flightSetupPath(row.flight_number, "pricing")}
                            >
                              Flight pricing
                            </RowActionMenuItem>
                            <RowActionMenuItem
                              icon={Scale}
                              accent
                              href={flightSetupPath(row.flight_number, "penalties")}
                            >
                              Flight penalties
                            </RowActionMenuItem>
                            <RowActionMenuItem
                              icon={Plane}
                              accent
                              href={flightSetupPath(row.flight_number, "schedules")}
                            >
                              View departures
                            </RowActionMenuItem>
                            <RowActionMenuItem
                              icon={LayoutGrid}
                              accent
                              href={flightSetupPath(row.flight_number, "plans")}
                            >
                              Recurring plans
                            </RowActionMenuItem>
                            <RowActionMenuItem
                              icon={Trash2}
                              variant="destructive"
                              doctype="Flight Setup"
                              permission="delete"
                              onClick={() => {
                                setDeleteLinkedPlansOpen(false);
                                setDeleteTarget({
                                  flight_number: row.flight_number,
                                  plan_count: row.plan_count,
                                  schedule_count: row.schedule_count,
                                });
                              }}
                            >
                              Delete flight setup
                            </RowActionMenuItem>
                          </RowActionMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <BilanFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title={
          isCreate
            ? "New flight setup"
            : editTarget
              ? `Edit flight ${editTarget}`
              : "Edit flight"
        }
        description="Flight number, route, default aircraft, and terms for this flight setup (step 1)."
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editLoading}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold-dark"
              onClick={saveForm}
              disabled={editLoading}
            >
              {isCreate ? "Create" : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-8">
          <FormSection title="Flight details">
            <FormGrid>
              {isCreate ? (
                <FormField label="Flight number" required fullWidth hint="e.g. KQ100">
                  <Input
                    value={editForm.flight_number}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, flight_number: e.target.value.toUpperCase() }))
                    }
                    placeholder="KQ100"
                  />
                </FormField>
              ) : null}
              <FormField label="Route" required fullWidth>
                <SearchableSelect
                  options={routes}
                  value={editForm.route}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, route: v }))}
                  placeholder="Select route..."
                  clearable={false}
                />
              </FormField>
              <FormField label="From" fullWidth>
                <Input readOnly value={fromLabel || "—"} className="bg-muted/50" />
              </FormField>
              <FormField label="To" fullWidth>
                <Input readOnly value={toLabel || "—"} className="bg-muted/50" />
              </FormField>
              <FormField label="Default aircraft" required fullWidth>
                <SearchableSelect
                  options={airplanes}
                  value={editForm.airplane}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, airplane: v }))}
                  placeholder="Select aircraft..."
                  clearable={false}
                />
              </FormField>
            </FormGrid>
            <div className="mt-6 flex items-center justify-between rounded-lg border p-4">
              <Label htmlFor="flight-setup-active" className="text-sm font-normal">
                Active for booking
              </Label>
              <Switch
                id="flight-setup-active"
                checked={editForm.is_active}
                onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </FormSection>
          <FormSection title="Terms & conditions">
            <Textarea
              value={editForm.terms_and_conditions}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, terms_and_conditions: e.target.value }))
              }
              rows={8}
              placeholder="Ticket and booking terms shown for this flight number..."
              className="min-h-[180px]"
            />
          </FormSection>
        </div>
      </BilanFormDialog>

      <DetailSheet
        open={!!selectedFlightNumber}
        onOpenChange={(open) => !open && setSelectedFlightNumber(null)}
        title={selectedFlightNumber || ""}
        subtitle="Flight setup"
        isLoading={detailLoading}
        footer={
          selectedFlightNumber ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
              <PermissionGate doctype="Flight Setup" permission="write">
                <Button
                  className="bg-gold text-navy hover:bg-gold-dark min-w-[140px] flex-1"
                  onClick={() => {
                    const fn = selectedFlightNumber;
                    setSelectedFlightNumber(null);
                    void openEdit(fn);
                  }}
                >
                  Edit flight setup
                </Button>
              </PermissionGate>
              <PermissionGate doctype="Flight Setup" permission="write">
                <Button
                  variant="outline"
                  className="min-w-[140px] flex-1"
                  disabled={toggleLoadingFlightNumber === selectedFlightNumber}
                  onClick={() =>
                    void handleToggleActive(selectedFlightNumber, selectedIsActive)
                  }
                >
                  {selectedIsActive ? "Deactivate" : "Activate"}
                </Button>
              </PermissionGate>
              <Button variant="outline" className="min-w-[140px] flex-1" asChild>
                <Link href={flightSetupPath(selectedFlightNumber, "pricing")}>Flight pricing</Link>
              </Button>
              <Button variant="outline" className="min-w-[140px] flex-1" asChild>
                <Link href={flightSetupPath(selectedFlightNumber, "schedules")}>View departures</Link>
              </Button>
              <Button variant="outline" className="min-w-[140px] flex-1" asChild>
                <Link href={flightSetupPath(selectedFlightNumber, "plans")}>Recurring plans</Link>
              </Button>
              <PermissionGate doctype="Flight Setup" permission="delete">
                <Button
                  variant="outline"
                  className="min-w-[140px] flex-1 border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setDeleteLinkedPlansOpen(false);
                    setDeleteTarget({
                      flight_number: selectedFlightNumber,
                      plan_count: selectedRow?.plan_count,
                      schedule_count: selectedRow?.schedule_count,
                    });
                  }}
                >
                  Delete flight setup
                </Button>
              </PermissionGate>
            </div>
          ) : undefined
        }
      >
        {(detail || selectedRow) && (
          <>
            <DetailSection title="Flight setup">
              <DetailRow label="Flight number" value={selectedFlightNumber} />
              <DetailRow
                label="Route"
                value={
                  detail?.route_label ||
                  selectedRow?.route_label ||
                  detail?.route ||
                  selectedRow?.route ||
                  "—"
                }
              />
              <DetailRow
                label="From"
                value={detail?.origin_label || selectedRow?.origin_label || "—"}
              />
              <DetailRow
                label="To"
                value={detail?.destination_label || selectedRow?.destination_label || "—"}
              />
              <DetailRow
                label="Aircraft"
                value={detail?.airplane || selectedRow?.airplane_label || selectedRow?.airplane || "—"}
              />
              <DetailRow
                label="Active for booking"
                value={
                  (detail?.is_active ?? selectedRow?.is_active) !== 0 &&
                  (detail?.is_active ?? selectedRow?.is_active) !== false
                    ? "Yes"
                    : "No"
                }
              />
            </DetailSection>
            <DetailSection title="Counts">
              <DetailRow label="Recurring plans" value={selectedRow?.plan_count ?? 0} />
              <DetailRow label="Schedules" value={selectedRow?.schedule_count ?? 0} />
              <DetailRow
                label="Next departure"
                value={
                  selectedRow?.next_departure
                    ? `${formatDate(selectedRow.next_departure)}${
                        selectedRow.next_departure_time
                          ? ` ${selectedRow.next_departure_time.slice(0, 5)}`
                          : ""
                      }`
                    : "—"
                }
              />
              <DetailRow label="Updated by" value={selectedRow?.updated_by || "—"} />
              <DetailRow label="Updated on" value={formatDateTime(selectedRow?.updated_on)} />
            </DetailSection>
            {detail?.terms_and_conditions ? (
              <DetailSection title="Terms & conditions">
                <p className="whitespace-pre-wrap text-sm">{richTextToPlain(detail.terms_and_conditions)}</p>
              </DetailSection>
            ) : null}
          </>
        )}
      </DetailSheet>

      <ConfirmActionDialog
        open={!!deleteTarget && !deleteLinkedPlansOpen}
        onOpenChange={(open) => !open && resetDeleteFlow()}
        title="Delete flight setup?"
        description={
          <>
            <p>
              Delete <strong>{deleteTarget?.flight_number}</strong>? This removes the flight setup
              master, including its pricing and penalty setup.
            </p>
            {!!((deleteTarget?.plan_count ?? 0) || (deleteTarget?.schedule_count ?? 0)) && (
              <p className="text-destructive">
                This flight setup still has <strong>{deleteTarget?.plan_count ?? 0}</strong>{" "}
                recurring plan(s) and <strong>{deleteTarget?.schedule_count ?? 0}</strong>{" "}
                departure(s).
              </p>
            )}
          </>
        }
        confirmLabel={(deleteTarget?.plan_count ?? 0) > 0 ? "Next" : "Delete"}
        tone="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />

      <ConfirmActionDialog
        open={!!deleteTarget && deleteLinkedPlansOpen}
        onOpenChange={(open) => setDeleteLinkedPlansOpen(open)}
        title="Delete linked recurring plans first?"
        description={
          <>
            <p>
              <strong>{deleteTarget?.flight_number}</strong> still has linked recurring plans.
            </p>
            <p className="text-destructive">
              Delete <strong>{deleteTarget?.plan_count ?? 0}</strong> recurring plan(s)
              {deleteTarget?.schedule_count
                ? ` and up to ${deleteTarget.schedule_count} linked departure(s)`
                : ""}{" "}
              first, then continue deleting the original flight setup.
            </p>
          </>
        }
        confirmLabel="Delete linked recurring"
        tone="destructive"
        loading={deleteLoading}
        onConfirm={handleDeleteLinkedPlansAndFlightSetup}
      />
    </div>
  );
}
