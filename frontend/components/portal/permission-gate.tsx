"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/contexts/permissions-context";
import type { PortalPermissionType } from "@/lib/portal-permissions";

type PermissionGateProps = {
  children: ReactNode;
  /** Hide children when the user lacks permission on this doctype. */
  doctype?: string;
  /** Single permission to require (default: write). */
  permission?: PortalPermissionType;
  /** Show when the user has any one of these permissions. */
  anyOf?: PortalPermissionType[];
};

export function PermissionGate({
  children,
  doctype,
  permission = "write",
  anyOf,
}: PermissionGateProps) {
  const { can } = usePermissions();
  if (!doctype) return <>{children}</>;

  const allowed = anyOf?.length
    ? anyOf.some((ptype) => can(doctype, ptype))
    : can(doctype, permission);

  if (!allowed) return null;
  return <>{children}</>;
}
