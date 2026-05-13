import type { Metadata } from "next";
import HeroSection from "@components/sections/community/hero-section";
import ProgramsSection from "@components/sections/community/programs-section";
import ValuesSection from "@components/sections/community/values-section";
import CtaSection from "@components/sections/community/cta-section";

export const metadata: Metadata = {
  title: "Community | Essentia Social Wellness Club",
  description:
    "Join Essentia's exclusive community of like-minded individuals committed to wellness, longevity, and personal growth in Tenerife.",
};

export default function CommunityPage() {
  return (
    <>
      <HeroSection />
      <ProgramsSection />
      <ValuesSection />
      <CtaSection />
    </>
  );
}
