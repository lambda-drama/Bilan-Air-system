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

import type { AgentReportKey } from "@/lib/portal-permissions";

export type PortalNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Frappe doctype required for read access; omit for always-visible items. */
  doctype?: string | null;
  /** BA Settings report flag for Booking Agent access. */
  reportKey?: AgentReportKey | null;
};

export type PortalNavGroup = {
  type: "group";
  label: string;
  icon: LucideIcon;
  items: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
    doctype?: string | null;
    reportKey?: AgentReportKey | null;
  }>;
};

export type PortalNavItem = PortalNavLink | PortalNavGroup;

export const portalNavItems: PortalNavItem[] = [
  { type: "link", href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  {
    type: "group",
    label: "Flights",
    icon: Plane,
    items: [
      { href: "/portal/flights/setup", label: "Flight setup", icon: Settings, doctype: "Flight Setup" },
      { href: "/portal/flights/recurring", label: "Recurring", icon: Repeat, doctype: "Flight Schedule Plan" },
      { href: "/portal/flights", label: "All departures", icon: Calendar, doctype: "Flight Schedule" },
    ],
  },
  { type: "link", href: "/portal/seat-inventory", label: "Seat inventory", icon: Armchair, doctype: "Seat Inventory" },
  { type: "link", href: "/portal/bookings", label: "Bookings", icon: Ticket, doctype: "Air Booking" },
  { type: "link", href: "/portal/check-in", label: "Check-in", icon: ClipboardCheck, doctype: "Air Booking" },
  { type: "link", href: "/portal/baggage", label: "Baggage", icon: Luggage, doctype: "Baggage Tracking" },
  { type: "link", href: "/portal/passengers", label: "Passengers", icon: Users, doctype: "Passenger" },
  { type: "link", href: "/portal/direct-messages", label: "Direct Message", icon: MessageSquare, doctype: "Website Contact Message" },
  {
    type: "group",
    label: "Master",
    icon: Warehouse,
    items: [
      { href: "/portal/master/airports", label: "Airports", icon: Building2, doctype: "Airport" },
      { href: "/portal/master/airlines", label: "Airlines", icon: Plane, doctype: "Airline" },
      { href: "/portal/master/routes", label: "Routes", icon: MapPin, doctype: "Flight Route" },
      { href: "/portal/master/airplanes", label: "Airplanes", icon: Plane, doctype: "Airplane" },
      { href: "/portal/master/cabin-classes", label: "Cabin classes", icon: Armchair, doctype: "Cabin Class" },
      { href: "/portal/master/seat-classes", label: "Fare classes", icon: Armchair, doctype: "Seat Class" },
      { href: "/portal/master/ticket-terms", label: "Ticket terms", icon: FileText, doctype: "Ticket Terms" },
    ],
  },
  {
    type: "group",
    label: "Users",
    icon: Users,
    items: [
      { href: "/portal/users/booking-agents", label: "Booking agents", icon: UserCog, doctype: "Booking Agent" },
      { href: "/portal/users/crew-members", label: "Crew members", icon: IdCard, doctype: "Crew Member" },
    ],
  },
  { type: "link", href: "/portal/fare-rules", label: "Fare rules", icon: Percent, doctype: "Fare Rule" },
  { type: "link", href: "/portal/invoices", label: "Invoices", icon: FileText, doctype: "Sales Invoice" },
  { type: "link", href: "/portal/payments", label: "Payments", icon: FileText, doctype: "Payment Entry" },
  {
    type: "group",
    label: "Reports",
    icon: BarChart3,
    items: [
      {
        href: "/portal/reports/analytics",
        label: "Analytics",
        icon: BarChart3,
        doctype: "Air Booking",
        reportKey: "analytics",
      },
      {
        href: "/portal/reports/m-fest",
        label: "M.Fest",
        icon: FileText,
        doctype: "Flight Schedule",
        reportKey: "manifest",
      },
      {
        href: "/portal/reports/no-show",
        label: "No show report",
        icon: UserX,
        doctype: "Air Booking",
        reportKey: "no_show",
      },
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
