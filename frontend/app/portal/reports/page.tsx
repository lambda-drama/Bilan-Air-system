"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/contexts/permissions-context";
import { PortalLoadingScreen } from "@/components/portal/portal-loading-screen";

const REPORT_LANDING_ROUTES = [
  { key: "analytics" as const, href: "/portal/reports/analytics" },
  { key: "manifest" as const, href: "/portal/reports/m-fest" },
  { key: "no_show" as const, href: "/portal/reports/no-show" },
  { key: "agent_sales" as const, href: "/portal/reports/agent-sales" },
];

export default function PortalReportsIndexPage() {
  const router = useRouter();
  const { canViewReport, isLoading } = usePermissions();

  useEffect(() => {
    if (isLoading) return;
    const target = REPORT_LANDING_ROUTES.find(({ key }) => canViewReport(key));
    router.replace(target?.href ?? "/portal?access_denied=1");
  }, [canViewReport, isLoading, router]);

  return <PortalLoadingScreen message="Opening reports" />;
}
