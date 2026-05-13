import type { Metadata } from "next";
import { Suspense } from "react";
import { MembershipsContent } from "./content";

export const metadata: Metadata = {
  title: "Memberships | Essentia Social Wellness Club",
  description:
    "Exclusive membership plans at Essentia giving you full access to our longevity center, wellness protocols, and community in Tenerife.",
};

export default function MembershipsPage() {
  return (
    <Suspense>
      <MembershipsContent />
    </Suspense>
  );
}
