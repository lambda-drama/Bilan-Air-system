/** Fired when a portal nav link is clicked (before full page load on Frappe). */
export const PORTAL_NAV_START_EVENT = "bilan-portal-nav-start";

export function signalPortalNavStart() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PORTAL_NAV_START_EVENT));
}
