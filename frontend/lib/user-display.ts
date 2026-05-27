import type { FrappeUser } from "@/services/auth";

export function getUserInitials(user: Pick<FrappeUser, "full_name" | "name">): string {
  const source = (user.full_name || user.name || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function resolveUserImageUrl(userImage?: string | null): string | undefined {
  if (!userImage?.trim()) return undefined;
  const path = userImage.trim();
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

export function formatRoleLabel(roles: string[]): string {
  if (!roles.length) return "User";
  const primary = roles.find((r) => !["All", "Guest", "Desk User"].includes(r)) || roles[0];
  return primary.replace(/_/g, " ");
}
