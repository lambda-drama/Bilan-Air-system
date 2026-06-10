"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FormAlerts } from "@/components/portal/form-alerts";
import { clearPortalPointerLocks } from "@/lib/portal-pointer-lock";

interface BilanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  validationErrors?: string[];
  submitError?: string | null;
  validationTitle?: string;
  onDismissAlerts?: () => void;
}

export function BilanFormDialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className,
  validationErrors,
  submitError,
  validationTitle,
  onDismissAlerts,
}: BilanFormDialogProps) {
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onDismissAlerts?.();
      clearPortalPointerLocks();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn("gap-0 overflow-hidden p-0 sm:max-w-lg", className)}>
        <DialogHeader className="bilan-panel-header space-y-1 text-left">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto px-6 py-4">
          <FormAlerts
            validationErrors={validationErrors}
            submitError={submitError}
            validationTitle={validationTitle}
            onDismiss={onDismissAlerts}
            className="mb-4"
          />
          {children}
        </div>
        <DialogFooter className="bilan-panel-footer sm:justify-end">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FormGrid({
  children,
  cols = 2,
  className,
}: {
  children: React.ReactNode;
  cols?: 1 | 2;
  className?: string;
}) {
  return (
    <div className={cn(cols === 2 ? "bilan-form-grid" : "grid gap-4", className)}>{children}</div>
  );
}

export function FormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}

export function FormField({
  label,
  children,
  className,
  fullWidth,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className={cn("bilan-form-field", fullWidth && "sm:col-span-2", className)}>
      <label className="text-sm font-medium leading-none">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="bilan-form-control">{children}</div>
    </div>
  );
}
