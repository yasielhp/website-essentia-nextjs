import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import HeroSection from "@components/sections/wellness/hero-section";
import ProtocolsSection from "@components/sections/wellness/protocols-section";
import ApproachSection from "@components/sections/wellness/approach-section";
import CtaSection from "@components/sections/wellness/cta-section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "wellness.meta" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical: locale === "es" ? "/es/bienestar" : "/wellness",
      languages: {
        en: "/wellness",
        es: "/es/bienestar",
        "x-default": "/wellness",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
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
