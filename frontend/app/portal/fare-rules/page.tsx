"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/portal/confirm-action-dialog";
import { PortalMasterPageHeader } from "@/components/portal/portal-master-page-header";
import { fetchAllRoutes } from "@/services/flightRoute";
import {
  deleteFareRule,
  listFareRules,
  saveFareRule,
  type FareRuleRow,
} from "@/services/fareRule";
import {
  BilanFormDialog,
  FormField,
  FormGrid,
} from "@/components/portal/form-dialog";
import { getMissingRequired } from "@/lib/validate-form";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { DocLink } from "@/components/portal/doc-link";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { ListSearch } from "@/components/portal/list-search";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { Badge } from "@/components/ui/badge";
import { formatRouteDisplay } from "@/lib/format-airport";
import { cn } from "@/lib/utils";

const emptyForm = {
  route: "",
  days_before_departure: "",
  price_increase_percentage: "",
  priority: "0",
  is_active: true,
};

export default function PortalFareRulesPage() {
  const fetchRules = useCallback(async (search: string) => {
    const res = await listFareRules({ search: search.trim() || undefined, limit: 200 });
    return res.data;
  }, []);
  const { search, setSearch, rows, loading, refresh } = useLiveListQuery<FareRuleRow>(
    fetchRules,
  );

  const [routes, setRoutes] = useState<
    {
      name: string;
      route_name?: string;
      origin_airport?: string;
      destination_airport?: string;
      origin_airport_label?: string;
      destination_airport_label?: string;
    }[]
  >([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);
  const formAlerts = useFormDialogAlerts();

  useEffect(() => {
    fetchAllRoutes().then(setRoutes).catch(() => setRoutes([]));
  }, []);

  const routeEndpointLabel = useCallback(
    (rule: FareRuleRow, end: "origin" | "destination") => {
      const labelKey = end === "origin" ? "origin_airport_label" : "destination_airport_label";
      if (rule[labelKey]) return String(rule[labelKey]);
      const link = rule[end === "origin" ? "origin_airport" : "destination_airport"];
      const route = routes.find((r) => r.name === rule.route);
      if (route?.[labelKey]) return String(route[labelKey]);
      return link || "";
    },
    [routes],
  );

  const ruleRouteLabel = useCallback(
    (rule: FareRuleRow) => {
      const origin = routeEndpointLabel(rule, "origin");
      const destination = routeEndpointLabel(rule, "destination");
      if (origin && destination) return `${origin} → ${destination}`;
      return origin || destination || "";
    },
    [routeEndpointLabel],
  );

  const routeOptions = useMemo(
    () =>
      routes.map((r) => {
        const endpoints =
          r.origin_airport_label && r.destination_airport_label
            ? `${r.origin_airport_label} → ${r.destination_airport_label}`
            : formatRouteDisplay(
                { linkName: r.origin_airport },
                { linkName: r.destination_airport },
              );
        return {
          value: r.name,
          label: `${r.route_name || r.name} (${endpoints})`,
        };
      }),
    [routes],
  );

  const selectedRow = rows.find((r) => r.name === selectedId);

  const openCreate = () => {
    formAlerts.clearAlerts();
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (rule: FareRuleRow) => {
    formAlerts.clearAlerts();
    setEditingId(rule.name);
    setForm({
      route: rule.route,
      days_before_departure: String(rule.days_before_departure),
      price_increase_percentage: String(rule.price_increase_percentage),
      priority: String(rule.priority ?? 0),
      is_active: Boolean(rule.is_active),
    });
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      formAlerts.clearAlerts();
      setEditingId(null);
      setForm(emptyForm);
    }
  };

  const handleSave = async () => {
    const missing = getMissingRequired(form, [
      { key: "route", label: "Route" },
      { key: "days_before_departure", label: "Days before departure" },
      { key: "price_increase_percentage", label: "Price increase %" },
    ]);
    const extra = [...missing];
    const days = parseInt(form.days_before_departure, 10);
    const pct = parseFloat(form.price_increase_percentage);
    const priority = parseInt(form.priority, 10);
    if (Number.isNaN(days) || days < 0) {
      extra.push("Days before departure must be zero or greater");
    }
    if (Number.isNaN(pct) || pct < 0) {
      extra.push("Price increase must be zero or greater");
    }
    if (Number.isNaN(priority)) {
      extra.push("Priority must be a number");
    }
    if (extra.length) {
      formAlerts.showValidation(extra);
      return;
    }

    formAlerts.clearAlerts();
    try {
      await saveFareRule({
        ...(editingId ? { name: editingId } : {}),
        route: form.route,
        days_before_departure: days,
        price_increase_percentage: pct,
        priority: priority || 0,
        is_active: form.is_active ? 1 : 0,
      });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      formAlerts.clearAlerts();
      refresh();
      toast.success(editingId ? "Fare rule updated" : "Fare rule created");
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to save fare rule");
    }
  };

  const handleDelete = async (name: string) => {
    setDeleteLoading(true);
    try {
      await deleteFareRule(name);
      setDeleteConfirmName(null);
      if (selectedId === name) setSelectedId(null);
      refresh();
      toast.success("Fare rule deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete fare rule");
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleActive = async (rule: FareRuleRow) => {
    try {
      await saveFareRule({
        name: rule.name,
        route: rule.route,
        days_before_departure: rule.days_before_departure,
        price_increase_percentage: rule.price_increase_percentage,
        priority: rule.priority ?? 0,
        is_active: rule.is_active ? 0 : 1,
      });
      refresh();
      toast.success(rule.is_active ? "Fare rule deactivated" : "Fare rule activated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update fare rule");
    }
  };

  return (
    <div className="space-y-6">
      <PortalMasterPageHeader
        title="Fare rules"
        description="Set price increases by route and booking lead time. When several rules match, the one with the smallest day threshold is used."
        addLabel="New fare rule"
        onAdd={openCreate}
      />

      <ListSearch
        value={search}
        onChange={setSearch}
        placeholder="Search rule ID or route..."
      />

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Days before departure</TableHead>
                <TableHead>Price increase</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {search.trim() ? "No fare rules match your search." : "No fare rules yet."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((rule) => (
                  <TableRow
                    key={rule.name}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(rule.name)}
                  >
                    <TableCell>
                      <DocLink onClick={() => setSelectedId(rule.name)}>{rule.name}</DocLink>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{rule.route_name || rule.route}</div>
                      {ruleRouteLabel(rule) && (
                        <div className="text-xs text-muted-foreground">{ruleRouteLabel(rule)}</div>
                      )}
                    </TableCell>
                    <TableCell>≤ {rule.days_before_departure} days out</TableCell>
                    <TableCell>+{rule.price_increase_percentage}%</TableCell>
                    <TableCell>{rule.priority ?? 0}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          rule.is_active
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {rule.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <ListRowActions doctype="Fare Rule" docName={rule.name}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(rule)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleActive(rule)}>
                              {rule.is_active ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              disabled={deleteLoading}
                              onClick={() => setDeleteConfirmName(rule.name)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ListRowActions>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <BilanFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        className="sm:max-w-xl"
        title={editingId ? `Edit ${editingId}` : "New fare rule"}
        description="Applies when the passenger books with this many days or fewer before departure."
        validationErrors={formAlerts.validationErrors}
        submitError={formAlerts.submitError}
        onDismissAlerts={formAlerts.clearAlerts}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-gold text-navy hover:bg-gold-dark" onClick={handleSave}>
              {editingId ? "Save changes" : "Create"}
            </Button>
          </>
        }
      >
        <FormGrid>
          <FormField label="Route" required fullWidth>
            <SearchableSelect
              options={routeOptions}
              value={form.route}
              onValueChange={(v) => setForm({ ...form, route: v })}
              placeholder="Select route..."
              emptyMessage="No route found"
              clearable={false}
            />
          </FormField>
          <FormField label="Days before departure (max)" required>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="e.g. 7"
              value={form.days_before_departure}
              onChange={(e) => setForm({ ...form, days_before_departure: e.target.value })}
            />
          </FormField>
          <FormField label="Price increase (%)" required>
            <Input
              type="number"
              min={0}
              step={0.1}
              placeholder="e.g. 15"
              value={form.price_increase_percentage}
              onChange={(e) => setForm({ ...form, price_increase_percentage: e.target.value })}
            />
          </FormField>
          <FormField label="Priority">
            <Input
              type="number"
              step={1}
              placeholder="0"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />
          </FormField>
          <FormField label="Active" fullWidth>
            <div className="flex h-9 items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <span className="text-sm text-muted-foreground">
                Rule is applied to pricing when active
              </span>
            </div>
          </FormField>
        </FormGrid>
      </BilanFormDialog>

      <DetailSheet
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selectedRow?.name || "Fare rule"}
        subtitle={selectedRow?.route_name || selectedRow?.route}
        badge={
          selectedRow
            ? { label: selectedRow.is_active ? "Active" : "Inactive", variant: "secondary" }
            : undefined
        }
        footer={
          selectedRow ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                className="bg-gold text-navy hover:bg-gold-dark flex-1"
                onClick={() => openEdit(selectedRow)}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => toggleActive(selectedRow)}
              >
                {selectedRow.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                disabled={deleteLoading}
                onClick={() => setDeleteConfirmName(selectedRow.name)}
                aria-label="Delete fare rule"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedRow && (
          <DetailSection title="Rule">
            <DetailRow label="ID" value={selectedRow.name} />
            <DetailRow label="Route" value={selectedRow.route_name || selectedRow.route} />
            <DetailRow
              label="Airports"
              value={
                ruleRouteLabel(selectedRow)
                  ? ruleRouteLabel(selectedRow)
                  : "—"
              }
            />
            <DetailRow
              label="Applies when"
              value={`${selectedRow.days_before_departure} or fewer days before departure`}
            />
            <DetailRow
              label="Price increase"
              value={`+${selectedRow.price_increase_percentage}%`}
            />
            <DetailRow label="Priority" value={String(selectedRow.priority ?? 0)} />
            <DetailRow label="Active" value={selectedRow.is_active ? "Yes" : "No"} />
          </DetailSection>
        )}
      </DetailSheet>

      <ConfirmActionDialog
        open={!!deleteConfirmName}
        onOpenChange={(open) => !open && setDeleteConfirmName(null)}
        title="Delete fare rule?"
        description={
          deleteConfirmName ? (
            <>
              <p>
                Fare rule <span className="font-medium text-foreground">{deleteConfirmName}</span>{" "}
                will be permanently removed.
              </p>
              <p>This cannot be undone.</p>
            </>
          ) : null
        }
        confirmLabel="Delete"
        tone="destructive"
        loading={deleteLoading}
        onConfirm={() => {
          if (deleteConfirmName) void handleDelete(deleteConfirmName);
        }}
      />
    </div>
  );
}
