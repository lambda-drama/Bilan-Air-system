"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { usePermissions } from "@/contexts/permissions-context";
import { PortalLoadingScreen } from "@/components/portal/portal-loading-screen";
import { Button } from "@/components/ui/button";

export function PortalRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccessRoute, isLoading } = usePermissions();
  const allowed = canAccessRoute(pathname || "/portal");

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.replace("/portal?access_denied=1");
    }
  }, [allowed, isLoading, router]);

  if (isLoading) {
    return <PortalLoadingScreen message="Checking permissions" />;
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Access denied</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You do not have permission to view this page.
          </p>
        </div>
        <Button onClick={() => router.replace("/portal")}>Back to dashboard</Button>
      </div>
    );
  }

  return <>{children}</>;
}
