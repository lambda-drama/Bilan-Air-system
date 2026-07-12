"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/contexts/permissions-context";
import { filterNavByPermissions } from "@/lib/portal-permissions";
import {
  isNavGroupActive,
  isNavItemActive,
  portalNavItems,
  type PortalNavGroup,
  type PortalNavItem,
} from "@/lib/portal-nav";
import { signalPortalNavStart } from "@/lib/portal-navigation";

function onPortalNavClick(onNavigate?: () => void) {
  signalPortalNavStart();
  onNavigate?.();
}

function useVisibleNavItems() {
  const { permissions, agentReports, hasFullAccess, permissionsReady } = usePermissions();
  const { user } = useAuth();
  return useMemo(() => {
    return portalNavItems
      .map((item): PortalNavItem | null => {
        if (item.type === "link") {
          return filterNavByPermissions(
            [item],
            permissions,
            hasFullAccess,
            permissionsReady,
            agentReports,
            user?.roles,
          ).length
            ? item
            : null;
        }
        const visibleItems = filterNavByPermissions(
          item.items,
          permissions,
          hasFullAccess,
          permissionsReady,
          agentReports,
          user?.roles,
        );
        if (!visibleItems.length) return null;
        return { ...item, items: visibleItems };
      })
      .filter((item): item is PortalNavItem => item !== null);
  }, [permissions, agentReports, hasFullAccess, permissionsReady, user?.roles]);
}

export function PortalSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const visibleNavItems = useVisibleNavItems();

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const item of visibleNavItems) {
      if (item.type === "group" && isNavGroupActive(pathname, item)) {
        next[item.label] = true;
      }
    }
    setOpenGroups((prev) => ({ ...prev, ...next }));
  }, [pathname, visibleNavItems]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const linkClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] font-medium tracking-tight transition-all",
      active
        ? "border-gold bg-sidebar-accent text-sidebar-accent-foreground"
        : "border-transparent text-cream/70 hover:bg-navy-light hover:text-cream",
    );

  const renderGroup = (group: PortalNavGroup) => {
    const open = openGroups[group.label] ?? false;

    return (
      <div key={group.label} className="space-y-1.5">
        <button
          type="button"
          onClick={() => toggleGroup(group.label)}
          className="mb-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-cream/45 hover:text-cream/70"
        >
          <span>{group.label}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 stroke-[1.5] transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {open && (
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const groupHrefs = group.items.map((i) => i.href);
              const active = isNavItemActive(pathname, item.href, groupHrefs);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={() => onPortalNavClick(onNavigate)}
                  className={linkClass(active)}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 stroke-[1.5]",
                      active ? "text-gold" : "opacity-65",
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-navy-light px-4">
        <Link
          href="/portal"
          prefetch={false}
          className="flex min-w-0 items-center gap-2 pr-8 lg:pr-0"
          onClick={() => onPortalNavClick(onNavigate)}
        >
          <BrandLogo className="h-8 w-8 rounded-full" />
          <span className="font-serif-display truncate text-lg font-semibold tracking-tight text-cream">
            Bilan Air
          </span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-5 [-webkit-overflow-scrolling:touch]">
        {visibleNavItems.map((item, index) =>
          item.type === "link" ? (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => onPortalNavClick(onNavigate)}
              className={linkClass(isNavItemActive(pathname, item.href))}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 stroke-[1.5]",
                  isNavItemActive(pathname, item.href) ? "text-gold" : "opacity-65",
                )}
              />
              {item.label}
            </Link>
          ) : (
            <div key={item.label} className={cn(index > 0 && "pt-4")}>
              {renderGroup(item)}
            </div>
          ),
        )}
      </nav>

      <div className="shrink-0 border-t border-navy-light p-4">
        <Link
          href="/"
          prefetch={false}
          onClick={() => onPortalNavClick(onNavigate)}
          className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-[13px] font-medium tracking-tight text-cream/70 transition-all hover:bg-navy-light hover:text-cream"
        >
          <LogOut className="h-4 w-4 stroke-[1.5]" />
          Back to Website
        </Link>
      </div>
    </div>
  );
}
