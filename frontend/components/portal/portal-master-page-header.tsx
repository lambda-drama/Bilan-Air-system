"use client";

import { Plus } from "lucide-react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { Button } from "@/components/ui/button";
import { useDoctypePermission } from "@/contexts/permissions-context";

export function PortalMasterPageHeader({
  title,
  description,
  addLabel,
  onAdd,
  doctype,
}: {
  title: string;
  description?: string;
  addLabel: string;
  onAdd: () => void;
  /** When set, add actions are hidden unless the user has create permission. */
  doctype?: string;
}) {
  const { allowed: canCreate } = useDoctypePermission(doctype, "create");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-center justify-between gap-3 sm:block sm:min-w-0">
        <div className="min-w-0">
          <h1 className="font-serif-display text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="hidden text-muted-foreground sm:block">{description}</p>
          ) : null}
        </div>
        {canCreate ? (
          <Button
            type="button"
            size="icon"
            className="shrink-0 bg-gold text-navy hover:bg-gold-dark sm:hidden"
            aria-label={addLabel}
            onClick={onAdd}
          >
            <Plus className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <PortalAddButton className="hidden sm:inline-flex" onClick={onAdd} doctype={doctype}>
        {addLabel}
      </PortalAddButton>
    </div>
  );
}
