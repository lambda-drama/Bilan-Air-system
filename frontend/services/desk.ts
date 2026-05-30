export function openDeskDocument(doctype: string, name: string) {
  const route = doctype.trim().toLowerCase().replace(/\s+/g, "-");
  const base = typeof window !== "undefined" ? window.location.origin : "";
  window.open(`${base}/app/${route}/${encodeURIComponent(name)}`, "_blank", "noopener,noreferrer");
}
