"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import * as authService from "@/services/auth";
import type { FrappeUser } from "@/services/auth";
import {
  readCachedPortalUser,
  writeCachedPortalUser,
} from "@/lib/portal-auth-cache";

interface AuthContextValue {
  user: FrappeUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: FrappeUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FrappeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = useCallback(async () => {
    const cached = readCachedPortalUser();
    if (cached) {
      setUser(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const logged = await authService.getLoggedUser();
      if (!logged) {
        setUser(null);
        writeCachedPortalUser(null);
        return;
      }
      const profile = await authService.getCurrentUserProfile(logged);
      setUser(profile);
      writeCachedPortalUser(profile);
    } catch {
      setUser(null);
      writeCachedPortalUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useLayoutEffect(() => {
    const cached = readCachedPortalUser();
    if (cached) {
      setUser(cached);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (email: string, password: string) => {
    const profile = await authService.login(email, password);
    setUser(profile);
    writeCachedPortalUser(profile);
    setIsLoading(false);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    writeCachedPortalUser(null);
  };

  const refreshUser = useCallback(async () => {
    try {
      const logged = await authService.getLoggedUser();
      if (!logged) {
        setUser(null);
        writeCachedPortalUser(null);
        return;
      }
      const profile = await authService.getCurrentUserProfile(logged);
      setUser(profile);
      writeCachedPortalUser(profile);
    } catch {
      setUser(null);
      writeCachedPortalUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        checkSession,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
