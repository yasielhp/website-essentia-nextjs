import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import HeroSection from "@components/sections/wellness/hero-section";
import ProtocolsSection from "@components/sections/wellness/protocols-section";
import ApproachSection from "@components/sections/wellness/approach-section";
import CtaSection from "@components/sections/wellness/cta-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wellness.meta");
  return {
    title: { absolute: t("title") },
    description: t("description"),
  };
}

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
