import type { Metadata } from "next";

export const revalidate = 3600;
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import RunningClubSection from "@components/sections/experiences/running-club-section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "experiences.runningClub.meta",
  });
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/experiencias/running-club"
          : "/experiences/running-club",
      languages: {
        en: "/experiences/running-club",
        es: "/es/experiencias/running-club",
        "x-default": "/experiences/running-club",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function RunningClubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RunningClubSection />;
}
