import type { FrappeUser } from "@/services/auth";

const CACHE_KEY = "bilan_portal_auth_v1";
const TTL_MS = 30 * 60 * 1000;

type CachedAuth = {
  user: FrappeUser;
  at: number;
};

export function readCachedPortalUser(): FrappeUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAuth;
    if (!parsed?.user?.name || Date.now() - parsed.at > TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.user;
  } catch {
    return null;
  }
}

export function writeCachedPortalUser(user: FrappeUser | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    sessionStorage.removeItem(CACHE_KEY);
    return;
  }
  sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ user, at: Date.now() } satisfies CachedAuth),
  );
}
