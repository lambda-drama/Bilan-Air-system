"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useDoctypePermission } from "@/contexts/permissions-context";
import type { PortalPermissionType } from "@/lib/portal-permissions";
import { cn } from "@/lib/utils";

const addButtonClass = "bg-gold text-navy hover:bg-gold-dark";

type PortalAddButtonProps = ButtonProps & {
  /** When set, the button is hidden unless the user has the required permission. */
  doctype?: string;
  permission?: PortalPermissionType;
};

/** Primary portal action: + icon before label (new booking, new route, etc.). */
export function PortalAddButton({
  className,
  children,
  doctype,
  permission = "create",
  ...props
}: PortalAddButtonProps) {
  const { allowed } = useDoctypePermission(doctype, permission);
  if (doctype && !allowed) return null;

  return (
    <Button className={cn(addButtonClass, className)} {...props}>
      <Plus className="mr-2 h-4 w-4 shrink-0" />
      {children}
    </Button>
  );
}

export function PortalAddLink({
  href,
  children,
  className,
  onNavigate,
  doctype,
  permission,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onNavigate?: () => void;
  doctype?: string;
  permission?: PortalPermissionType;
}) {
  const { allowed } = useDoctypePermission(doctype, permission ?? "create");
  if (doctype && !allowed) return null;

  return (
    <Button asChild className={cn(addButtonClass, className)}>
      <Link
        href={href}
        className="inline-flex items-center"
        onClick={() => onNavigate?.()}
      >
        <Plus className="mr-2 h-4 w-4 shrink-0" />
        {children}
      </Link>
    </Button>
  );
}
