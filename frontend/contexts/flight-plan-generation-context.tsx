"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { getPlanGenerationStatus } from "@/services/flightSchedulePlan";
import { toast } from "sonner";

export type ActivePlanGeneration = {
  planName: string;
  planTitle: string;
  expectedCount: number;
  processedCount: number;
};

type TrackGenerationOptions = {
  planName: string;
  planTitle?: string;
  expectedCount?: number;
  onComplete?: () => void;
};

type FlightPlanGenerationContextValue = {
  activeGenerations: ActivePlanGeneration[];
  trackGeneration: (options: TrackGenerationOptions) => void;
};

const FlightPlanGenerationContext =
  createContext<FlightPlanGenerationContextValue | null>(null);

const POLL_MS = 1500;
const TIMEOUT_MS = 15 * 60 * 1000;

function formatCompletionToast(
  planTitle: string,
  createdCount: number,
  skippedCount?: number,
): string {
  const skipped =
    skippedCount && skippedCount > 0 ? `, ${skippedCount} skipped` : "";
  return `${planTitle}: created ${createdCount} flight schedule(s)${skipped}.`;
}

export function FlightPlanGenerationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeGenerations, setActiveGenerations] = useState<
    ActivePlanGeneration[]
  >([]);
  const watchersRef = useRef<Map<string, () => void>>(new Map());

  const removeJob = useCallback((planName: string) => {
    setActiveGenerations((prev) => prev.filter((job) => job.planName !== planName));
    watchersRef.current.get(planName)?.();
    watchersRef.current.delete(planName);
  }, []);

  const trackGeneration = useCallback(
    (options: TrackGenerationOptions) => {
      const { planName, planTitle, expectedCount = 0, onComplete } = options;

      watchersRef.current.get(planName)?.();

      setActiveGenerations((prev) => {
        const existing = prev.find((job) => job.planName === planName);
        if (existing) {
          return prev.map((job) =>
            job.planName === planName
              ? {
                  ...job,
                  planTitle: planTitle ?? job.planTitle,
                  expectedCount: expectedCount || job.expectedCount,
                  processedCount: 0,
                }
              : job,
          );
        }
        return [
          ...prev,
          {
            planName,
            planTitle: planTitle ?? planName,
            expectedCount,
            processedCount: 0,
          },
        ];
      });

      const started = Date.now();
      const timer = window.setInterval(async () => {
        if (Date.now() - started > TIMEOUT_MS) {
          removeJob(planName);
          toast.error(
            "Flight schedule generation is taking longer than expected. Check back shortly.",
          );
          return;
        }

        try {
          const status = await getPlanGenerationStatus(planName);
          const label = status.plan_title || planTitle || planName;

          if (status.status === "running") {
            setActiveGenerations((prev) =>
              prev.map((job) =>
                job.planName === planName
                  ? {
                      ...job,
                      planTitle: label,
                      expectedCount:
                        status.expected_count ?? job.expectedCount,
                      processedCount: status.processed_count ?? job.processedCount,
                    }
                  : job,
              ),
            );
            return;
          }

          if (status.status === "complete") {
            removeJob(planName);
            toast.success(
              formatCompletionToast(
                label,
                status.created_count ?? 0,
                status.skipped_count,
              ),
            );
            onComplete?.();
            return;
          }

          if (status.status === "failed") {
            removeJob(planName);
            toast.error(
              status.message || "Flight schedule generation failed.",
            );
          }
        } catch {
          // Keep polling until timeout.
        }
      }, POLL_MS);

      watchersRef.current.set(planName, () => window.clearInterval(timer));
    },
    [removeJob],
  );

  const value = useMemo(
    () => ({ activeGenerations, trackGeneration }),
    [activeGenerations, trackGeneration],
  );

  return (
    <FlightPlanGenerationContext.Provider value={value}>
      {children}
    </FlightPlanGenerationContext.Provider>
  );
}

export function useFlightPlanGeneration() {
  const context = useContext(FlightPlanGenerationContext);
  if (!context) {
    throw new Error(
      "useFlightPlanGeneration must be used within FlightPlanGenerationProvider",
    );
  }
  return context;
}
