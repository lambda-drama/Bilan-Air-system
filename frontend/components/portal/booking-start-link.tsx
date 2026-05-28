"use client";

import { PortalAddLink } from "@/components/portal/portal-add-button";

export function BookingStartLink({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  onSuccess?: (pnr: string) => void;
}) {
  return (
    <PortalAddLink href="/portal/booking/new" className={className}>
      {children}
    </PortalAddLink>
  );
}
