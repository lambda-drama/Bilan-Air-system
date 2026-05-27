"use client";

import { AlertCircle, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FormAlertsProps {
  validationErrors?: string[];
  submitError?: string | null;
  validationTitle?: string;
  className?: string;
  onDismiss?: () => void;
}

export function FormAlerts({
  validationErrors = [],
  submitError,
  validationTitle = "Please complete the required fields",
  className,
  onDismiss,
}: FormAlertsProps) {
  const hasValidation = validationErrors.length > 0;
  const hasError = Boolean(submitError);

  if (!hasValidation && !hasError) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {hasValidation && (
        <Alert
          variant="destructive"
          className="relative border-destructive/40 bg-destructive/5 shadow-sm"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">{validationTitle}</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              {validationErrors.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </AlertDescription>
          {onDismiss && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10"
              onClick={onDismiss}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </Alert>
      )}

      {hasError && (
        <Alert
          variant="destructive"
          className="relative border-destructive/40 bg-destructive/5 shadow-sm"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Could not save</AlertTitle>
          <AlertDescription className="text-sm">{submitError}</AlertDescription>
          {onDismiss && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10"
              onClick={onDismiss}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </Alert>
      )}
    </div>
  );
}
