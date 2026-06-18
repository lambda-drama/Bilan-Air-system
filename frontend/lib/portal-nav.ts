import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  BarChart3,
  Building2,
  Calendar,
  ClipboardCheck,
  FileText,
  IdCard,
  LayoutDashboard,
  Luggage,
  MapPin,
  MessageSquare,
  Percent,
  Plane,
  Repeat,
  Settings,
  Ticket,
  UserCog,
  UserX,
  Users,
  Warehouse,
} from "lucide-react";

export type PortalNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type PortalNavGroup = {
  type: "group";
  label: string;
  icon: LucideIcon;
  items: Array<{ href: string; label: string; icon: LucideIcon }>;
};

export type PortalNavItem = PortalNavLink | PortalNavGroup;

export const portalNavItems: PortalNavItem[] = [
  { type: "link", href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  {
    type: "group",
    label: "Flights",
    icon: Plane,
    items: [
      { href: "/portal/flights/setup", label: "Flight setup", icon: Settings },
      { href: "/portal/flights/recurring", label: "Recurring", icon: Repeat },
      { href: "/portal/flights", label: "All departures", icon: Calendar },
    ],
  },
  { type: "link", href: "/portal/seat-inventory", label: "Seat inventory", icon: Armchair },
  { type: "link", href: "/portal/bookings", label: "Bookings", icon: Ticket },
  { type: "link", href: "/portal/check-in", label: "Check-in", icon: ClipboardCheck },
  { type: "link", href: "/portal/baggage", label: "Baggage", icon: Luggage },
  { type: "link", href: "/portal/passengers", label: "Passengers", icon: Users },
  { type: "link", href: "/portal/direct-messages", label: "Direct Message", icon: MessageSquare },
  {
    type: "group",
    label: "Master",
    icon: Warehouse,
    items: [
      { href: "/portal/master/airports", label: "Airports", icon: Building2 },
      { href: "/portal/master/airlines", label: "Airlines", icon: Plane },
      { href: "/portal/master/routes", label: "Routes", icon: MapPin },
      { href: "/portal/master/airplanes", label: "Airplanes", icon: Plane },
      { href: "/portal/master/cabin-classes", label: "Cabin classes", icon: Armchair },
      { href: "/portal/master/seat-classes", label: "Fare classes", icon: Armchair },
      { href: "/portal/master/ticket-terms", label: "Ticket terms", icon: FileText },
    ],
  },
  {
    type: "group",
    label: "Users",
    icon: Users,
    items: [
      { href: "/portal/users/booking-agents", label: "Booking agents", icon: UserCog },
      { href: "/portal/users/crew-members", label: "Crew members", icon: IdCard },
    ],
  },
  { type: "link", href: "/portal/fare-rules", label: "Fare rules", icon: Percent },
  { type: "link", href: "/portal/invoices", label: "Invoices", icon: FileText },
  { type: "link", href: "/portal/payments", label: "Payments", icon: FileText },
  {
    type: "group",
    label: "Reports",
    icon: BarChart3,
    items: [
      { href: "/portal/reports/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/portal/reports/m-fest", label: "M.Fest", icon: FileText },
      { href: "/portal/reports/no-show", label: "No show report", icon: UserX },
    ],
  },
  { type: "link", href: "/portal/settings", label: "Settings", icon: Settings },
];

function pathnameMatchesNav(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** When several nav links share a prefix, pick the longest matching href. */
export function resolveActiveNavHref(pathname: string, hrefs: string[]): string | null {
  const sorted = [...hrefs].sort((a, b) => b.length - a.length);
  for (const href of sorted) {
    if (pathnameMatchesNav(pathname, href)) return href;
  }
  return null;
}

export function isNavItemActive(pathname: string, href: string, siblingHrefs?: string[]) {
  if (siblingHrefs?.length) {
    return resolveActiveNavHref(pathname, siblingHrefs) === href;
  }
  return pathnameMatchesNav(pathname, href);
}

export function isNavGroupActive(pathname: string, group: PortalNavGroup) {
  const hrefs = group.items.map((item) => item.href);
  return resolveActiveNavHref(pathname, hrefs) !== null;
}
