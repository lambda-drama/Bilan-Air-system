"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { hasFullPortalPermissions, hasPortalAccess } from "@/lib/portal-access";
import {
  canAccessDoctype,
  canViewAgentReport,
  DEFAULT_AGENT_REPORT_PERMISSIONS,
  DENIED_AGENT_REPORT_PERMISSIONS,
  resolveRouteDoctype,
  resolveRouteReportKey,
  resolveRouteAllowedRoles,
  userHasAnyRequiredRole,
  type AgentReportKey,
  type AgentReportPermissions,
  type PortalPermissionType,
  type PortalPermissionsMap,
} from "@/lib/portal-permissions";
import { fetchPortalPermissions, normalizePortalPermissionsResponse } from "@/services/permissions";

interface PermissionsContextValue {
  permissions: PortalPermissionsMap | null;
  agentReports: AgentReportPermissions | null;
  permissionsReady: boolean;
  hasFullAccess: boolean;
  isLoading: boolean;
  can: (doctype: string | null | undefined, ptype?: PortalPermissionType) => boolean;
  canViewReport: (reportKey: AgentReportKey) => boolean;
  canAccessRoute: (pathname: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

function applyPermissionsPayload(
  payload: {
    has_full_access?: boolean;
    permissions?: PortalPermissionsMap;
    agent_reports?: AgentReportPermissions;
  },
  setPermissions: (value: PortalPermissionsMap | null) => void,
  setAgentReports: (value: AgentReportPermissions | null) => void,
  setHasFullAccessFromApi: (value: boolean) => void,
  setPermissionsReady: (value: boolean) => void,
) {
  if (payload.permissions && typeof payload.permissions === "object") {
    setPermissions(payload.permissions);
    setPermissionsReady(true);
  }
  if (payload.agent_reports && typeof payload.agent_reports === "object") {
    setAgentReports(payload.agent_reports);
  } else if (payload.has_full_access) {
    setAgentReports(DEFAULT_AGENT_REPORT_PERMISSIONS);
  } else if (payload.permissions) {
    setAgentReports(DENIED_AGENT_REPORT_PERMISSIONS);
  }
  setHasFullAccessFromApi(!!payload.has_full_access);
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [permissions, setPermissions] = useState<PortalPermissionsMap | null>(null);
  const [agentReports, setAgentReports] = useState<AgentReportPermissions | null>(null);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [hasFullAccessFromApi, setHasFullAccessFromApi] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const hasFullAccessFromRoles = useMemo(
    () => hasFullPortalPermissions(user?.roles, user?.name),
    [user?.roles, user?.name],
  );

  const hasFullAccess = hasFullAccessFromRoles || hasFullAccessFromApi;
  const portalStaff = hasPortalAccess(user?.roles);

  useEffect(() => {
    if (!user?.permissions) return;
    applyPermissionsPayload(
      { permissions: user.permissions, has_full_access: user.has_full_access, agent_reports: user.agent_reports },
      setPermissions,
      setAgentReports,
      setHasFullAccessFromApi,
      setPermissionsReady,
    );
    setIsLoading(false);
  }, [user?.permissions, user?.has_full_access, user?.agent_reports]);

  const refreshPermissions = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setPermissions(null);
      setAgentReports(null);
      setPermissionsReady(false);
      setHasFullAccessFromApi(false);
      setIsLoading(false);
      return;
    }
    if (hasFullPortalPermissions(user.roles, user.name)) {
      setHasFullAccessFromApi(true);
      setAgentReports(DEFAULT_AGENT_REPORT_PERMISSIONS);
      setPermissionsReady(true);
      setIsLoading(false);
      return;
    }
    if (user.permissions) {
      applyPermissionsPayload(
        {
          permissions: user.permissions,
          has_full_access: user.has_full_access,
          agent_reports: user.agent_reports,
        },
        setPermissions,
        setAgentReports,
        setHasFullAccessFromApi,
        setPermissionsReady,
      );
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const raw = await fetchPortalPermissions();
      const next = normalizePortalPermissionsResponse(raw);
      applyPermissionsPayload(
        next,
        setPermissions,
        setAgentReports,
        setHasFullAccessFromApi,
        setPermissionsReady,
      );
    } catch {
      setPermissions(null);
      setAgentReports(null);
      setPermissionsReady(false);
      setHasFullAccessFromApi(false);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  const can = useCallback(
    (doctype: string | null | undefined, ptype: PortalPermissionType = "read") => {
      if (hasFullAccess) return true;
      if (!permissionsReady && portalStaff) return true;
      return canAccessDoctype(permissions, doctype, ptype, false, isLoading);
    },
    [permissions, hasFullAccess, permissionsReady, portalStaff, isLoading],
  );

  const canViewReport = useCallback(
    (reportKey: AgentReportKey) => {
      if (hasFullAccess) return true;
      if (!permissionsReady) return false;
      return canViewAgentReport(agentReports, reportKey, false);
    },
    [agentReports, hasFullAccess, permissionsReady],
  );

  const canAccessRoute = useCallback(
    (pathname: string) => {
      const path = pathname.split("?")[0]?.replace(/\/$/, "") || "/portal";
      const requiredRoles = resolveRouteAllowedRoles(path);
      if (!userHasAnyRequiredRole(user?.roles, requiredRoles)) return false;
      const reportKey = resolveRouteReportKey(path);
      if (reportKey && !canViewReport(reportKey)) return false;
      const doctype = resolveRouteDoctype(path);
      if (doctype === undefined) return true;
      return can(doctype, "read");
    },
    [can, canViewReport],
  );

  const value = useMemo(
    () => ({
      permissions,
      agentReports,
      permissionsReady,
      hasFullAccess,
      isLoading: hasFullAccess ? false : isLoading,
      can,
      canViewReport,
      canAccessRoute,
      refreshPermissions,
    }),
    [
      permissions,
      agentReports,
      permissionsReady,
      hasFullAccess,
      isLoading,
      can,
      canViewReport,
      canAccessRoute,
      refreshPermissions,
    ],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be used within PermissionsProvider");
  return ctx;
}

/** Convenience hook for a single doctype check. */
export function useDoctypePermission(
  doctype: string | null | undefined,
  ptype: PortalPermissionType = "read",
) {
  const { can, isLoading } = usePermissions();
  return { allowed: can(doctype, ptype), isLoading };
}
