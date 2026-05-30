import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Bilan Air — A Somali Aviation Brand Built for Africa",
  description:
    "Learn how Bilan Air connects East Africa with Somali pride — our fleet, values, network, and journey from Nairobi to the region.",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
