"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PORTAL_NAV_START_EVENT } from "@/lib/portal-navigation";
import { cn } from "@/lib/utils";

const ACTIVE_MS = 700;

export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  const pulse = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), ACTIVE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let clearTimer: (() => void) | undefined;
    const run = () => {
      clearTimer?.();
      clearTimer = pulse();
    };
    run();
    return () => clearTimer?.();
  }, [pathname, pulse]);

  useEffect(() => {
    const onNavStart = () => {
      pulse();
    };
    window.addEventListener(PORTAL_NAV_START_EVENT, onNavStart);
    return () => window.removeEventListener(PORTAL_NAV_START_EVENT, onNavStart);
  }, [pulse]);

  if (!active) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[300] h-[3px] overflow-hidden bg-gold/15",
        "bilan-nav-progress",
      )}
      aria-hidden
    >
      <div className="bilan-nav-progress-bar h-full bg-gradient-to-r from-gold via-gold-light to-gold" />
    </div>
  );
}
