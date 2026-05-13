import type { Metadata } from "next";
import HeroSection from "@components/sections/wellness/hero-section";
import ProtocolsSection from "@components/sections/wellness/protocols-section";
import ApproachSection from "@components/sections/wellness/approach-section";
import CtaSection from "@components/sections/wellness/cta-section";

export const metadata: Metadata = {
  title: "Wellness | Essentia Social Wellness Club",
  description:
    "Discover Essentia's comprehensive wellness protocols in Tenerife — contrast therapy, breathwork, red light therapy, manual therapies, and functional well-being.",
};

export default function WellnessPage() {
  return (
    <>
      <HeroSection />
      <ProtocolsSection />
      <ApproachSection />
      <CtaSection />
    </>
  );
}
