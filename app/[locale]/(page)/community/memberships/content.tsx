"use client";

import HeroSection from "@components/sections/memberships/hero-section";
import TierSelector from "@components/sections/memberships/tier-selector";
import ComparisonSection from "@components/sections/memberships/comparison-section";
import FaqSection from "@components/sections/memberships/faq-section";
import CtaSection from "@components/sections/memberships/cta-section";

export function MembershipsContent() {
  return (
    <>
      <HeroSection />
      <TierSelector />
      <ComparisonSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
