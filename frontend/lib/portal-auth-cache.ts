import type { FrappeUser } from "@/services/auth";

const CACHE_KEY = "bilan_portal_auth_v5";
const TTL_MS = 30 * 60 * 1000;

type CachedAuth = {
  user: FrappeUser;
  at: number;
};

function readFromStorage(storage: Storage): FrappeUser | null {
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAuth;
    if (!parsed?.user?.name || Date.now() - parsed.at > TTL_MS) {
      storage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.user;
  } catch {
    storage.removeItem(CACHE_KEY);
    return null;
  }
}

export function readCachedPortalUser(): FrappeUser | null {
  if (typeof window === "undefined") return null;
  return readFromStorage(sessionStorage) ?? readFromStorage(localStorage);
}

export function writeCachedPortalUser(user: FrappeUser | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    sessionStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_KEY);
    return;
  }
  const payload = JSON.stringify({ user, at: Date.now() } satisfies CachedAuth);
  sessionStorage.setItem(CACHE_KEY, payload);
  localStorage.setItem(CACHE_KEY, payload);
}
