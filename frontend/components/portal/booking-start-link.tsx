"use client";

import { useState } from "react";
import { PortalAddButton } from "@/components/portal/portal-add-button";
import { OfficeBookingDialog } from "@/components/portal/office-booking-dialog";

export function BookingStartLink({
  children,
  className,
  onSuccess,
}: {
  children: React.ReactNode;
  className?: string;
  onSuccess?: (pnr: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PortalAddButton className={className} onClick={() => setOpen(true)}>
        {children}
      </PortalAddButton>
      <OfficeBookingDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={(pnr) => {
          onSuccess?.(pnr);
        }}
      />
    </>
  );
}
