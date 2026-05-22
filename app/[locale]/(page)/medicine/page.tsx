import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import HeroSection from "@components/sections/medicine/hero-section";
import TreatmentsSection from "@components/sections/medicine/treatments-section";
import ApproachSection from "@components/sections/medicine/approach-section";
import CtaSection from "@components/sections/medicine/cta-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("medicine.meta");
  return {
    title: { absolute: t("title") },
    description: t("description"),
  };
}

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
