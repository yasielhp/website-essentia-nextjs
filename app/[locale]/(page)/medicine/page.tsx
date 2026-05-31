import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import HeroSection from "@components/sections/medicine/hero-section";
import TreatmentsSection from "@components/sections/medicine/treatments-section";
import ApproachSection from "@components/sections/medicine/approach-section";
import CtaSection from "@components/sections/medicine/cta-section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "medicine.meta" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical: locale === "es" ? "/es/medicine" : "/medicine",
      languages: {
        en: "/medicine",
        es: "/es/medicine",
        "x-default": "/medicine",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
    },
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
