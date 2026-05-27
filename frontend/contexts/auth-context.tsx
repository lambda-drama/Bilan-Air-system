"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as authService from "@/services/auth";
import type { FrappeUser } from "@/services/auth";

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
    setIsLoading(true);
    try {
      const logged = await authService.getLoggedUser();
      if (!logged) {
        setUser(null);
        return;
      }
      const profile = await authService.getCurrentUserProfile();
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (email: string, password: string) => {
    const profile = await authService.login(email, password);
    setUser(profile);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    try {
      const profile = await authService.getCurrentUserProfile();
      setUser(profile);
    } catch {
      setUser(null);
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
