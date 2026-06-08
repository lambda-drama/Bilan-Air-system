import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  BarChart3,
  Building2,
  ClipboardCheck,
  FileText,
  IdCard,
  LayoutDashboard,
  Luggage,
  MapPin,
  MessageSquare,
  Percent,
  Plane,
  Settings,
  Ticket,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";

export type PortalNavLink = {
  type: "link";
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
  { type: "link", href: "/portal/flights", label: "Flight schedule", icon: Plane },
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
      { href: "/portal/master/seat-classes", label: "Seat classes", icon: Armchair },
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
  { type: "link", href: "/portal/reports", label: "Reports", icon: BarChart3 },
  { type: "link", href: "/portal/settings", label: "Settings", icon: Settings },
];

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavGroupActive(pathname: string, group: PortalNavGroup) {
  return group.items.some((item) => isNavItemActive(pathname, item.href));
}
