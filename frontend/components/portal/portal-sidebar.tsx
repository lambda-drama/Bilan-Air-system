"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Plane } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  isNavGroupActive,
  isNavItemActive,
  portalNavItems,
  type PortalNavGroup,
} from "@/lib/portal-nav";
import { signalPortalNavStart } from "@/lib/portal-navigation";

function onPortalNavClick(onNavigate?: () => void) {
  signalPortalNavStart();
  onNavigate?.();
}

export function PortalSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const item of portalNavItems) {
      if (item.type === "group" && isNavGroupActive(pathname, item)) {
        next[item.label] = true;
      }
    }
    setOpenGroups((prev) => ({ ...prev, ...next }));
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      active ? "bg-gold text-navy" : "text-cream/70 hover:bg-navy-light hover:text-cream",
    );

  const renderGroup = (group: PortalNavGroup) => {
    const open = openGroups[group.label] ?? false;
    const groupActive = isNavGroupActive(pathname, group);

    return (
      <div key={group.label} className="space-y-0.5">
        <button
          type="button"
          onClick={() => toggleGroup(group.label)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            groupActive
              ? "bg-navy-light/80 text-cream"
              : "text-cream/70 hover:bg-navy-light hover:text-cream",
          )}
        >
          <group.icon className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          />
        </button>
        {open && (
          <div className="ml-3 space-y-0.5 border-l border-cream/15 pl-2">
            {group.items.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={() => onPortalNavClick(onNavigate)}
                  className={linkClass(active)}
                >
                  <item.icon className="h-4 w-4 shrink-0 opacity-80" />
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
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-navy-light px-4">
        <Link
          href="/portal"
          prefetch={false}
          className="flex items-center gap-2"
          onClick={() => onPortalNavClick(onNavigate)}
        >
          <Plane className="h-8 w-8 text-gold" />
          <span className="font-serif text-xl font-bold text-cream">Bilan Air</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {portalNavItems.map((item) =>
          item.type === "link" ? (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => onPortalNavClick(onNavigate)}
              className={linkClass(isNavItemActive(pathname, item.href))}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ) : (
            renderGroup(item)
          ),
        )}
      </nav>

      <div className="shrink-0 border-t border-navy-light p-4">
        <Link
          href="/"
          prefetch={false}
          onClick={() => onPortalNavClick(onNavigate)}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream/70 transition-colors hover:bg-navy-light hover:text-cream"
        >
          <LogOut className="h-5 w-5" />
          Back to Website
        </Link>
      </div>
    </div>
  );
}
