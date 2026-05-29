/** Safe internal path only (no open redirects). */
export function getSafeRedirect(param: string | null | undefined): string | null {
  if (!param) return null;
  const path = param.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

/** Leave the static site shell for Frappe routes like /app. */
export function followAuthRedirect(path: string) {
  window.location.assign(path);
}
