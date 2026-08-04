import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import HeroSection from "@components/sections/experiences/hero-section";
import ProgramsSection from "@components/sections/experiences/programs-section";
import ValuesSection from "@components/sections/experiences/values-section";
import CtaSection from "@components/sections/experiences/cta-section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "experiences.meta" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical: locale === "es" ? "/es/experiencias" : "/experiences",
      languages: {
        en: "/experiences",
        es: "/es/experiencias",
        "x-default": "/experiences",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
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
