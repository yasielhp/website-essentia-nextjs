import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { defaultOgImage } from "@/constants/metadata";
import AboutSection from "@components/sections/about/about-section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: locale === "es" ? "/es/nosotros" : "/about",
      languages: {
        en: "/about",
        es: "/es/nosotros",
        "x-default": "/about",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: defaultOgImage,
    },
  };
}

export default function AboutPage() {
  return <AboutSection />;
}
