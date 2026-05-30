import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Online Check-in — Bilan Air",
  description:
    "Check in online from 24 hours up to 2 hours before your flight and get your boarding pass instantly.",
};

export default function CheckInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
