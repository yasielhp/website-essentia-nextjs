import type { Metadata } from "next";
import HeroSection from "@components/sections/medicine/hero-section";
import TreatmentsSection from "@components/sections/medicine/treatments-section";
import ApproachSection from "@components/sections/medicine/approach-section";
import CtaSection from "@components/sections/medicine/cta-section";

export const metadata: Metadata = {
  title: "Medicine | Essentia Longevity Center",
  description:
    "Advanced preventive medicine and longevity protocols at Essentia in Tenerife. Science-backed treatments designed to extend healthspan.",
};

export default function MedicinePage() {
  return (
    <>
      <HeroSection />
      <TreatmentsSection />
      <ApproachSection />
      <CtaSection />
    </>
  );
}
