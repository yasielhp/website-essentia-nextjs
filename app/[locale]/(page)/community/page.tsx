import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import HeroSection from "@components/sections/community/hero-section";
import ProgramsSection from "@components/sections/community/programs-section";
import ValuesSection from "@components/sections/community/values-section";
import CtaSection from "@components/sections/community/cta-section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: locale === "es" ? "/es/comunidad" : "/community",
      languages: {
        en: "/community",
        es: "/es/comunidad",
        "x-default": "/community",
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
