import { cn } from "@/lib/utils";

/** Fills portal main area so the table can scroll with a pinned pagination footer. */
export function PaginatedListPage({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[calc(100dvh-6rem)] flex-col gap-6 lg:min-h-[calc(100dvh-7rem)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

type PaginatedListContainerProps = {
  children: React.ReactNode;
  pagination: React.ReactNode;
  className?: string;
};

/** Scrollable table body with pagination pinned below it (inside the card). */
export function PaginatedListContainer({
  children,
  pagination,
  className,
}: PaginatedListContainerProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card",
        className,
      )}
    >
      <div className="min-h-0 flex-1 overflow-auto pb-14">{children}</div>
      {pagination}
    </div>
  );
}
