"use client";

import { useCallback, useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  fetchFlightDetails,
  listSchedules,
  rescheduleFlight,
  type FlightScheduleRow,
} from "@/services/flightSchedule";
import { BilanFormDialog, FormField, FormGrid } from "@/components/portal/form-dialog";
import { getMissingRequired } from "@/lib/validate-form";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { DocLink } from "@/components/portal/doc-link";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { ListSearch } from "@/components/portal/list-search";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useRouter } from "next/navigation";

export default function PortalSchedulesPage() {
  const router = useRouter();
  const fetchSchedules = useCallback(async (search: string) => {
    const res = await listSchedules({ limit: 100, search: search.trim() || undefined });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, refresh } = useLiveListQuery<FlightScheduleRow>(
    fetchSchedules,
  );
  const [rescheduleTarget, setRescheduleTarget] = useState<FlightScheduleRow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, string> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState({
    reschedule_reason: "",
    new_departure_date: "",
    new_departure_time: "",
    new_arrival_date: "",
    new_arrival_time: "",
  });
  const formAlerts = useFormDialogAlerts();

  const openOfficeBooking = (scheduleId: string) => {
    router.push(`/portal/booking/new/seats?schedule=${encodeURIComponent(scheduleId)}`);
  };

  const handleRescheduleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setRescheduleTarget(null);
      formAlerts.clearAlerts();
    }
  };

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

  const openReschedule = (s: FlightScheduleRow) => {
    formAlerts.clearAlerts();
    setRescheduleTarget(s);
    setForm({
      reschedule_reason: "",
      new_departure_date: s.departure_date,
      new_departure_time: s.departure_time,
      new_arrival_date: s.arrival_date,
      new_arrival_time: s.arrival_time,
    });
  };

  const submitReschedule = async () => {
    if (!rescheduleTarget) return;

    const missing = getMissingRequired(form, [
      { key: "reschedule_reason", label: "Reason" },
      { key: "new_departure_date", label: "New departure date" },
      { key: "new_departure_time", label: "New departure time" },
      { key: "new_arrival_date", label: "New arrival date" },
      { key: "new_arrival_time", label: "New arrival time" },
    ]);
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }

    formAlerts.clearAlerts();
    try {
      await rescheduleFlight({
        schedule_name: rescheduleTarget.name,
        ...form,
      });
      setRescheduleTarget(null);
      formAlerts.clearAlerts();
      refresh();
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Reschedule failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Flight schedules</h2>
        <p className="text-sm text-muted-foreground">View and reschedule departures</p>
      </div>

      <ListSearch
        value={search}
        onChange={setSearch}
        placeholder="Search flight no., route, or ID..."
      />

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Flight</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {search.trim() ? "No schedules match your search." : "No schedules yet."}
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
                  <TableCell>{s.flight_number}</TableCell>
                  <TableCell>{s.route}</TableCell>
                  <TableCell>
                    {s.departure_date} {s.departure_time}
                  </TableCell>
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

      <BilanFormDialog
        open={!!rescheduleTarget}
        onOpenChange={handleRescheduleDialogOpenChange}
        title={`Reschedule ${rescheduleTarget?.flight_number ?? ""}`}
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
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
        <FormField label="Reason" fullWidth>
          <Input
            value={form.reschedule_reason}
            onChange={(e) => setForm({ ...form, reschedule_reason: e.target.value })}
          />
        </FormField>
        <FormGrid className="mt-4">
          <FormField label="New departure date">
            <Input
              type="date"
              value={form.new_departure_date}
              onChange={(e) => setForm({ ...form, new_departure_date: e.target.value })}
            />
          </FormField>
          <FormField label="New departure time">
            <Input
              type="time"
              value={form.new_departure_time}
              onChange={(e) => setForm({ ...form, new_departure_time: e.target.value })}
            />
          </FormField>
          <FormField label="New arrival date">
            <Input
              type="date"
              value={form.new_arrival_date}
              onChange={(e) => setForm({ ...form, new_arrival_date: e.target.value })}
            />
          </FormField>
          <FormField label="New arrival time">
            <Input
              type="time"
              value={form.new_arrival_time}
              onChange={(e) => setForm({ ...form, new_arrival_time: e.target.value })}
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
              <DetailSection title="Route">
                <DetailRow label="Origin" value={detail.origin} />
                <DetailRow label="Destination" value={detail.destination} />
              </DetailSection>
            )}
          </>
        )}
      </DetailSheet>
    </div>
  );
}
