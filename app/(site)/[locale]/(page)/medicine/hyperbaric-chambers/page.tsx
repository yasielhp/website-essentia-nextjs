import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import { UNLAUNCHED_ROBOTS } from "@/constants/unlaunched";
import { ComingSoon } from "@components/coming-soon";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "medicine.pages.hyperbaric-chambers",
  });
  return {
    robots: UNLAUNCHED_ROBOTS,
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/medicina/camaras-hiperbaricas"
          : "/medicine/hyperbaric-chambers",
      languages: {
        en: "/medicine/hyperbaric-chambers",
        es: "/es/medicina/camaras-hiperbaricas",
        "x-default": "/medicine/hyperbaric-chambers",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function HyperbaricChambersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEs = locale === "es";

  return (
    <ComingSoon
      isEs={isEs}
      title={isEs ? "Cámaras Hiperbáricas" : "Hyperbaric Chambers"}
      body={
        isEs
          ? "Oxígeno a presión para acelerar la recuperación y la claridad mental."
          : "Pressurised oxygen to speed up recovery and sharpen focus."
      }
    />
  );
}
