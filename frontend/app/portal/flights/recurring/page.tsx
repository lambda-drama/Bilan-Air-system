"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Pencil, Plane, Trash2, Zap } from "lucide-react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { ConfirmActionDialog } from "@/components/portal/confirm-action-dialog";
import { RecurringPlanDialog } from "@/components/portal/recurring-plan-dialog";
import { ListSearch } from "@/components/portal/list-search";
import {
  RowActionMenu,
  RowActionMenuItem,
  RowActionMenuSeparator,
} from "@/components/portal/row-action-menu";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { useFlightPlanGeneration } from "@/contexts/flight-plan-generation-context";
import {
  deleteFlightSchedulePlan,
  generatePlanSchedules,
  listFlightSchedulePlans,
  recurringPlanSchedulesPath,
  type FlightSchedulePlanRow,
} from "@/services/flightSchedulePlan";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function RecurringFlightPlansContent() {
  const { trackGeneration } = useFlightPlanGeneration();
  const searchParams = useSearchParams();
  const fetchRows = useCallback(async (search: string) => {
    const res = await listFlightSchedulePlans({ search: search.trim() || undefined });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, refresh } = useLiveListQuery<FlightSchedulePlanRow>(
    fetchRows,
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlanName, setEditingPlanName] = useState<string | null>(null);
  const [defaultFlightNumber, setDefaultFlightNumber] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<FlightSchedulePlanRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const openCreate = () => {
    setEditingPlanName(null);
    setDefaultFlightNumber(undefined);
    setDialogOpen(true);
  };

  const openEdit = (planName: string) => {
    setEditingPlanName(planName);
    setDefaultFlightNumber(undefined);
    setDialogOpen(true);
  };

  useEffect(() => {
    const planName = searchParams.get("plan");
    const flightNumber = searchParams.get("flight_number");
    const isNew = searchParams.get("new");

    if (planName) {
      setEditingPlanName(planName);
      setDefaultFlightNumber(flightNumber || undefined);
      setDialogOpen(true);
      return;
    }

    if (isNew && flightNumber) {
      setEditingPlanName(null);
      setDefaultFlightNumber(flightNumber);
      setDialogOpen(true);
    }
  }, [searchParams]);

  const handleGenerate = async (planName: string) => {
    const plan = rows.find((row) => row.name === planName);
    try {
      const gen = await generatePlanSchedules(planName);
      toast.info("Generating in the background", {
        description: `${plan?.plan_title || planName} — creating ${gen.expected_count} flight schedule(s).`,
      });
      trackGeneration({
        planName,
        planTitle: plan?.plan_title,
        expectedCount: gen.expected_count,
        onComplete: refresh,
      });
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
            Save recurring rules here, then use Generate on each plan to create dated flight schedules.
          </p>
        </div>
        <PortalAddButton onClick={openCreate}>New recurring plan</PortalAddButton>
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
                <TableHead>Flight setup</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No recurring plans yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{p.plan_title}</TableCell>
                    <TableCell>{p.flight_number || "—"}</TableCell>
                    <TableCell>{p.frequency}</TableCell>
                    <TableCell>
                      {p.start_date} → {p.end_date}
                    </TableCell>
                    <TableCell>{p.route}</TableCell>
                    <TableCell>{p.generated_count ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <RowActionMenu>
                        <RowActionMenuItem icon={Pencil} onClick={() => openEdit(p.name)}>
                          Edit recurring plan
                        </RowActionMenuItem>
                        <RowActionMenuItem
                          icon={Plane}
                          accent
                          href={recurringPlanSchedulesPath(p)}
                        >
                          View departures
                        </RowActionMenuItem>
                        <RowActionMenuItem
                          icon={Zap}
                          accent
                          onClick={() => void handleGenerate(p.name)}
                        >
                          Generate schedules
                        </RowActionMenuItem>
                        <RowActionMenuSeparator />
                        <RowActionMenuItem
                          icon={Trash2}
                          variant="destructive"
                          disabled={(p.generated_count ?? 0) > 0}
                          onClick={() => setDeleteTarget(p)}
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

      <RecurringPlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        planName={editingPlanName}
        defaultFlightNumber={defaultFlightNumber}
        onSaved={refresh}
      />

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete recurring plan?"
        description={
          <>
            <p>
              Delete <strong>{deleteTarget?.plan_title || deleteTarget?.name}</strong>? This cannot
              be undone.
            </p>
            {(deleteTarget?.generated_count ?? 0) > 0 ? (
              <p className="text-destructive">
                This plan has generated schedules and cannot be deleted until those are removed.
              </p>
            ) : null}
          </>
        }
        confirmLabel="Delete"
        tone="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function RecurringFlightPlansPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <RecurringFlightPlansContent />
    </Suspense>
  );
}
