/** Prefix for exported static files served from Frappe `/assets/bilan_sky/frontend`. */
export const FRONTEND_ASSET_PREFIX =
  process.env.NODE_ENV === "production" ? "/assets/bilan_sky/frontend" : "";

export function staticAsset(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${FRONTEND_ASSET_PREFIX}${normalized}`;
}
