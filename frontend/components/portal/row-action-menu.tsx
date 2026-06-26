"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/contexts/permissions-context";
import type { PortalPermissionType } from "@/lib/portal-permissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RowActionMenu({ children }: { children: ReactNode }) {
  return (
    <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{children}</DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type RowActionMenuItemProps = {
  icon?: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "destructive";
  disabled?: boolean;
  /** Gold accent icon (portal secondary actions). */
  accent?: boolean;
  /** Hide this action when the user lacks the given doctype permission. */
  doctype?: string;
  permission?: PortalPermissionType;
  /** Show when the user has any one of these permissions (overrides `permission`). */
  anyOf?: PortalPermissionType[];
};

function actionIconClass(accent: boolean, variant: "default" | "destructive") {
  return cn(accent && variant !== "destructive" && "text-gold");
}

export function RowActionMenuItem({
  icon: Icon,
  children,
  onClick,
  href,
  variant = "default",
  disabled,
  accent = false,
  doctype,
  permission = "write",
  anyOf,
}: RowActionMenuItemProps) {
  const { can } = usePermissions();
  if (doctype) {
    const allowed = anyOf?.length
      ? anyOf.some((ptype) => can(doctype, ptype))
      : can(doctype, permission);
    if (!allowed) return null;
  }

  const iconClass = actionIconClass(accent, variant);

  if (href && !disabled) {
    return (
      <DropdownMenuItem asChild variant={variant}>
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {Icon ? <Icon className={iconClass} /> : null}
          {children}
        </Link>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      variant={variant}
      disabled={disabled}
    >
      {Icon ? <Icon className={iconClass} /> : null}
      {children}
    </DropdownMenuItem>
  );
}

export { DropdownMenuSeparator as RowActionMenuSeparator };
