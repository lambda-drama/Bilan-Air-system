"use client";

import { useCallback, useState } from "react";

export function useFormDialogAlerts() {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const clearAlerts = useCallback(() => {
    setValidationErrors([]);
    setSubmitError(null);
  }, []);

  const showValidation = useCallback((fields: string[]) => {
    setSubmitError(null);
    setValidationErrors(fields);
  }, []);

  return {
    validationErrors,
    submitError,
    setValidationErrors,
    setSubmitError,
    clearAlerts,
    showValidation,
  };
}
