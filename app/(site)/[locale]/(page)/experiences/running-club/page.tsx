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
    namespace: "experiences.runningClub.meta",
  });
  return {
    robots: UNLAUNCHED_ROBOTS,
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
  const isEs = locale === "es";

  return (
    <ComingSoon
      isEs={isEs}
      title="Running Club"
      body={
        isEs
          ? "Salidas en grupo por rutas de la costa de Costa Adeje, con entrenamiento y desayuno compartido."
          : "Group runs along the coastal routes of Costa Adeje, with structured training and a shared breakfast."
      }
    />
  );
}
