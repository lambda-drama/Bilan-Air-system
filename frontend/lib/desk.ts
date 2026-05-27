export function deskDocUrl(doctype: string, name: string): string {
  const slug = doctype.toLowerCase().replace(/\s+/g, "-");
  return `/app/${slug}/${encodeURIComponent(name)}`;
}
