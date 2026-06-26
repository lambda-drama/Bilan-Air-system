"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Plane, Trash2, Zap } from "lucide-react";
import { ConfirmActionDialog } from "@/components/portal/confirm-action-dialog";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { PermissionGate } from "@/components/portal/permission-gate";
import { Button } from "@/components/ui/button";
import {
  deleteFlightSchedulePlan,
  getFlightSchedulePlan,
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

function weeklyDaysLabel(doc: Record<string, unknown>) {
  const days = [
    ["Mon", doc.monday],
    ["Tue", doc.tuesday],
    ["Wed", doc.wednesday],
    ["Thu", doc.thursday],
    ["Fri", doc.friday],
    ["Sat", doc.saturday],
    ["Sun", doc.sunday],
  ]
    .filter(([, active]) => active)
    .map(([label]) => label);
  return days.length ? days.join(", ") : "—";
}

export type RecurringPlanDetailSheetProps = {
  planName: string | null;
  listRow?: FlightSchedulePlanRow | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (planName: string) => void;
  onGenerate?: (planName: string) => void | Promise<void>;
  onDeleted?: () => void;
};

export function RecurringPlanDetailSheet({
  planName,
  listRow,
  onOpenChange,
  onEdit,
  onGenerate,
  onDeleted,
}: RecurringPlanDetailSheetProps) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!planName) {
      setDetail(null);
      return;
    }
    setLoading(true);
    getFlightSchedulePlan(planName)
      .then(setDetail)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load plan");
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [planName, onOpenChange]);

  const generatedCount =
    (detail?.generated_count as number | undefined) ?? listRow?.generated_count ?? 0;
  const planTitle = String(detail?.plan_title || listRow?.plan_title || planName || "");
  const flightNumber = String(detail?.flight_number || listRow?.flight_number || "");
  const schedulesPath = planName
    ? recurringPlanSchedulesPath({
        name: planName,
        flight_number: flightNumber || undefined,
      })
    : "#";

  const handleDelete = async () => {
    if (!planName) return;
    setDeleteLoading(true);
    try {
      const result = await deleteFlightSchedulePlan(planName, {
        deleteSchedules: generatedCount > 0,
      });
      const scheduleMsg =
        (result.deleted_schedules ?? 0) > 0
          ? ` and ${result.deleted_schedules} schedule(s)`
          : "";
      toast.success(`Plan ${planTitle} deleted${scheduleMsg}`);
      setDeleteOpen(false);
      onOpenChange(false);
      onDeleted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <DetailSheet
        open={!!planName}
        onOpenChange={onOpenChange}
        title={planTitle}
        subtitle={planName || undefined}
        isLoading={loading}
        footer={
          planName ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
              <PermissionGate doctype="Flight Schedule Plan" permission="write">
                <Button
                  className="bg-gold text-navy hover:bg-gold-dark min-w-[140px] flex-1"
                  onClick={() => onEdit(planName)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit plan
                </Button>
              </PermissionGate>
              <Button variant="outline" className="min-w-[140px] flex-1" asChild>
                <Link href={schedulesPath} onClick={() => onOpenChange(false)}>
                  <Plane className="mr-2 h-4 w-4" />
                  View departures
                </Link>
              </Button>
              {onGenerate ? (
                <PermissionGate doctype="Flight Schedule" anyOf={["create", "write"]}>
                  <Button
                    variant="outline"
                    className="min-w-[140px] flex-1"
                    onClick={() => void onGenerate(planName)}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Generate schedules
                  </Button>
                </PermissionGate>
              ) : null}
              <PermissionGate doctype="Flight Schedule Plan" permission="delete">
                <Button
                  variant="outline"
                  className="min-w-[140px] flex-1 border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete plan
                </Button>
              </PermissionGate>
            </div>
          ) : undefined
        }
      >
        {detail ? (
          <>
            <DetailSection title="Plan">
              <DetailRow label="ID" value={String(detail.name || planName)} />
              <DetailRow label="Flight setup" value={String(detail.flight_number || "—")} />
              <DetailRow label="Route" value={String(detail.route || "—")} />
              <DetailRow label="Aircraft" value={String(detail.airplane || "—")} />
              <DetailRow label="Type" value={String(detail.plan_type || "Schedule")} />
              <DetailRow label="Status" value={String(detail.plan_status || "On-going")} />
            </DetailSection>
            <DetailSection title="Schedule pattern">
              <DetailRow label="Frequency" value={String(detail.frequency || "—")} />
              <DetailRow
                label="Period"
                value={`${formatDate(detail.start_date as string)} → ${formatDate(detail.end_date as string)}`}
              />
              {detail.frequency === "Weekly" ? (
                <DetailRow label="Days" value={weeklyDaysLabel(detail)} />
              ) : null}
              <DetailRow
                label="Departure"
                value={
                  detail.departure_time
                    ? String(detail.departure_time).slice(0, 5)
                    : "—"
                }
              />
              <DetailRow
                label="Arrival"
                value={
                  detail.arrival_time ? String(detail.arrival_time).slice(0, 5) : "—"
                }
              />
            </DetailSection>
            <DetailSection title="Generation">
              <DetailRow label="Generated schedules" value={generatedCount} />
              <DetailRow
                label="Last generated"
                value={
                  detail.last_generated_on
                    ? new Date(String(detail.last_generated_on)).toLocaleString()
                    : "—"
                }
              />
              <DetailRow
                label="Initial seats released"
                value={detail.initial_seats_released ?? "—"}
              />
            </DetailSection>
          </>
        ) : null}
      </DetailSheet>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete recurring plan?"
        description={
          <>
            <p>
              Delete <strong>{planTitle}</strong>? This cannot be undone.
            </p>
            {generatedCount > 0 ? (
              <p className="text-destructive">
                This plan has <strong>{generatedCount}</strong> generated flight schedule
                {generatedCount === 1 ? "" : "s"}. Deleting the plan will also permanently delete
                those schedules (only if they have no active bookings).
              </p>
            ) : null}
          </>
        }
        confirmLabel="Delete"
        tone="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </>
  );
}
