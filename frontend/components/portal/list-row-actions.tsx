"use client";

import type { ReactNode } from "react";
import { PrintFormatDropdown } from "@/components/portal/print-format-dropdown";

interface ListRowActionsProps {
  children: ReactNode;
  doctype: string;
  docName: string;
}

export function ListRowActions({ children, doctype, docName }: ListRowActionsProps) {
  return (
    <div
      className="flex items-center justify-end gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      <PrintFormatDropdown variant="icon" doctype={doctype} docName={docName} />
    </div>
  );
}
