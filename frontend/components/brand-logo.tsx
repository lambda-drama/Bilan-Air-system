import { BRAND_LOGO_URL } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  alt = "Bilan Air",
  src,
}: {
  className?: string;
  alt?: string;
  src?: string | null;
}) {
  return (
    <img
      src={src || BRAND_LOGO_URL}
      alt={alt}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/** Optional agency logo next to the airline brand on print documents. */
export function AgencyPrintLogo({
  src,
  className,
  alt = "Agency",
}: {
  src?: string | null;
  className?: string;
  alt?: string;
}) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
