"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadOfficeBookingDraft } from "@/lib/office-booking-store";
import { Button } from "@/components/ui/button";
import { useBookingSettings } from "@/hooks/use-booking-settings";

const ALL_STEPS = [
  { id: "search", label: "Find flight", path: "/portal/booking/new" },
  { id: "seats", label: "Select seats", path: "/portal/booking/new/seats" },
  { id: "travelers", label: "Travelers", path: "/portal/booking/new/travelers" },
  { id: "done", label: "Complete", path: "/portal/booking/new/done" },
] as const;

function visibleSteps(enableSeatSelection: boolean) {
  return enableSeatSelection
    ? ALL_STEPS
    : ALL_STEPS.filter((s) => s.id !== "seats");
}

function stepIndex(pathname: string | null, enableSeatSelection: boolean): number {
  if (!pathname) return 0;
  if (pathname.includes("/done")) return enableSeatSelection ? 3 : 2;
  if (pathname.includes("/travelers")) return enableSeatSelection ? 2 : 1;
  if (pathname.includes("/seats")) return 1;
  return 0;
}

function hrefForStep(
  step: (typeof ALL_STEPS)[number],
  index: number,
  current: number,
  enableSeatSelection: boolean,
): string | null {
  if (index >= current) return null;
  if (step.id === "seats") {
    const draft = loadOfficeBookingDraft();
    if (draft?.scheduleId) {
      return `${step.path}?schedule=${encodeURIComponent(draft.scheduleId)}`;
    }
  }
  if (step.id === "travelers") {
    const draft = loadOfficeBookingDraft();
    if (!draft?.scheduleId) return null;
    if (enableSeatSelection && !draft.selectedSeatIds?.length) return null;
    if (draft.scheduleId) {
      return `${step.path}?schedule=${encodeURIComponent(draft.scheduleId)}`;
    }
  }
  return step.path;
}

export function BookingFlowLayout({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  const pathname = usePathname();
  const { enableSeatSelection } = useBookingSettings();
  const steps = visibleSteps(enableSeatSelection);
  const current = stepIndex(pathname, enableSeatSelection);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
            <Link href="/portal/bookings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to bookings
            </Link>
          </Button>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>

      <nav aria-label="Booking progress" className="rounded-lg border bg-card p-4">
        <ol className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {steps.map((step, index) => {
            const done = index < current;
            const active = index === current;
            const backHref = hrefForStep(step, index, current, enableSeatSelection);
            const stepContent = (
              <>
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    active && "border-gold bg-gold text-navy",
                    done && "border-gold/50 bg-gold/10 text-gold",
                    !active && !done && "border-muted bg-muted/30",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span>{step.label}</span>
              </>
            );
            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-center gap-3 text-sm",
                  active && "font-medium text-foreground",
                  done && "text-muted-foreground",
                  !active && !done && "text-muted-foreground/60",
                )}
              >
                {backHref ? (
                  <Link
                    href={backHref}
                    className="flex items-center gap-3 rounded-md transition-colors hover:text-foreground"
                  >
                    {stepContent}
                  </Link>
                ) : (
                  stepContent
                )}
                {index < steps.length - 1 && (
                  <span className="hidden flex-1 border-t border-dashed sm:mx-2 sm:block" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="rounded-lg border bg-card p-4 sm:p-6">{children}</div>
    </div>
  );
}
