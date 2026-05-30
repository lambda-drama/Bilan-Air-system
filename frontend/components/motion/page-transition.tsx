"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type PageTransitionProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();
  const isPortal = pathname.startsWith("/portal");

  return (
    <div
      key={pathname}
      className={cn(
        isPortal ? "bilan-page-enter-portal" : "bilan-page-enter",
        className,
      )}
    >
      {children}
    </div>
  );
}
