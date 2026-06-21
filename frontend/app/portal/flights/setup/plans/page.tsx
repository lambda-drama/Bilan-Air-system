"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, Pencil, Plane, Trash2, Zap } from "lucide-react";
import { ConfirmActionDialog } from "@/components/portal/confirm-action-dialog";
import { DocLink } from "@/components/portal/doc-link";
import { RecurringPlanDialog } from "@/components/portal/recurring-plan-dialog";
import { RecurringPlanDetailSheet } from "@/components/portal/recurring-plan-detail-sheet";
import { ListSearch } from "@/components/portal/list-search";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import {
  RowActionMenu,
  RowActionMenuItem,
  RowActionMenuSeparator,
} from "@/components/portal/row-action-menu";
import { Badge } from "@/components/ui/badge";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { flightSetupPath } from "@/services/flightSetup";
import {
  deleteFlightSchedulePlan,
  generatePlanSchedules,
  listFlightSchedulePlans,
  recurringPlanSchedulesPath,
  type FlightSchedulePlanRow,
} from "@/services/flightSchedulePlan";
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

function FlightSetupPlansContent() {
  const searchParams = useSearchParams();
  const flightNumber = decodeURIComponent(searchParams.get("flight_number") || "");

  const fetchRows = useCallback(
    async (search: string) => {
      if (!flightNumber) return [];
      const res = await listFlightSchedulePlans({
        flight_number: flightNumber,
        search: search.trim() || undefined,
      });
      return res.data;
    },
    [flightNumber],
  );

  const { search, setSearch, rows, loading, error, refresh } =
    useLiveListQuery<FlightSchedulePlanRow>(fetchRows);

  const [deleteTarget, setDeleteTarget] = useState<FlightSchedulePlanRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlanName, setEditingPlanName] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingPlanName(null);
    setDialogOpen(true);
  };

  const openEdit = (planName: string) => {
    setEditingPlanName(planName);
    setDialogOpen(true);
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteFlightSchedulePlan(deleteTarget.name);
      toast.success(`Plan ${deleteTarget.plan_title || deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!flightNumber) {
    return (
      <p className="text-muted-foreground">
        Missing flight number.{" "}
        <Link href="/portal/flights/setup" className="text-gold hover:underline">
          Back to flight setup
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/portal/flights/setup" className="text-sm text-gold hover:underline">
            ← Flight setup
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Recurring — {flightNumber}</h1>
          <p className="text-muted-foreground">
            Master schedules that generate dated departures. Edit to set weekly/daily rules and seat
            capacity.
          </p>
        </div>
        <PortalAddButton onClick={openCreate}>New recurring plan</PortalAddButton>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-gold" />
              Recurring plans
            </CardTitle>
            <ListSearch
              value={search}
              onChange={setSearch}
              placeholder="Filter plans..."
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
                    <TableHead>Plan</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        No recurring plans for this flight yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow
                        key={row.name}
                        className="cursor-pointer"
                        onClick={() => setSelectedPlanId(row.name)}
                      >
                        <TableCell className="font-medium">
                          <DocLink onClick={() => setSelectedPlanId(row.name)}>
                            {row.plan_title || row.name}
                          </DocLink>
                        </TableCell>
                        <TableCell>{formatDate(row.start_date)}</TableCell>
                        <TableCell>{formatDate(row.end_date)}</TableCell>
                        <TableCell>
                          {row.departure_time?.slice(0, 5) || "—"}
                          {row.arrival_time ? (
                            <span className="text-muted-foreground">
                              {" → "}
                              {row.arrival_time.slice(0, 5)}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.plan_status || "On-going"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{row.type_label || row.frequency}</TableCell>
                        <TableCell>{row.generated_count ?? 0}</TableCell>
                        <TableCell>
                          <p className="text-sm">{row.modified_by || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(row.modified)}
                          </p>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <RowActionMenu>
                            <RowActionMenuItem icon={Pencil} onClick={() => openEdit(row.name)}>
                              Edit recurring plan
                            </RowActionMenuItem>
                            <RowActionMenuItem
                              icon={Plane}
                              accent
                              href={recurringPlanSchedulesPath(row)}
                            >
                              View departures
                            </RowActionMenuItem>
                            <RowActionMenuItem
                              icon={Zap}
                              accent
                              onClick={() => void handleGenerate(row.name)}
                            >
                              Generate schedules
                            </RowActionMenuItem>
                            <RowActionMenuSeparator />
                            <RowActionMenuItem
                              icon={Trash2}
                              variant="destructive"
                              disabled={(row.generated_count ?? 0) > 0}
                              onClick={() => setDeleteTarget(row)}
                            >
                              Delete plan
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

      <RecurringPlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        planName={editingPlanName}
        defaultFlightNumber={flightNumber}
        onSaved={refresh}
      />

      <RecurringPlanDetailSheet
        planName={selectedPlanId}
        listRow={rows.find((p) => p.name === selectedPlanId) ?? null}
        onOpenChange={(open) => !open && setSelectedPlanId(null)}
        onEdit={(planName) => {
          setSelectedPlanId(null);
          openEdit(planName);
        }}
        onGenerate={handleGenerate}
        onDeleted={refresh}
      />

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete recurring plan?"
        description={
          <p>
            Delete <strong>{deleteTarget?.plan_title || deleteTarget?.name}</strong>? This cannot
            be undone.
          </p>
        }
        confirmLabel="Delete"
        tone="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function FlightSetupPlansPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <FlightSetupPlansContent />
    </Suspense>
  );
}
