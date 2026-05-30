import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flight Status — Live Updates | Bilan Air",
  description:
    "Track Bilan Air flights by number, route, or booking reference. View today's schedule and live status updates.",
};

export default function FlightStatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
