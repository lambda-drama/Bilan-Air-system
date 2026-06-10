"use client";

import { PortalAddLink } from "@/components/portal/portal-add-button";

export function BookingStartLink({
  children,
  className,
  onNavigate,
}: {
  children: React.ReactNode;
  className?: string;
  onSuccess?: (pnr: string) => void;
  onNavigate?: () => void;
}) {
  return (
    <PortalAddLink href="/portal/booking/new" className={className} onNavigate={onNavigate}>
      {children}
    </PortalAddLink>
  );
}
