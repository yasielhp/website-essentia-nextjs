import type { Metadata } from "next";
import RunningClubSection from "@components/sections/community/running-club-section";

export const metadata: Metadata = {
  title: "Running Club | Essentia Community",
  description:
    "Join Essentia's running club in Tenerife. Every Saturday at 7:30 am — curated coastal routes, paced groups, and shared breakfast.",
};

export default function RunningClubPage() {
  return <RunningClubSection />;
}
