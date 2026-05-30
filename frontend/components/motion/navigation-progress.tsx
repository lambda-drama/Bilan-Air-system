"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 500);
    return () => window.clearTimeout(timer);
  }, [pathname]);

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
