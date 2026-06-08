import { BRAND_LOGO_URL } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  alt = "Bilan Air",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={BRAND_LOGO_URL}
      alt={alt}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
