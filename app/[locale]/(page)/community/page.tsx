import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import HeroSection from "@components/sections/community/hero-section";
import ProgramsSection from "@components/sections/community/programs-section";
import ValuesSection from "@components/sections/community/values-section";
import CtaSection from "@components/sections/community/cta-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

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
