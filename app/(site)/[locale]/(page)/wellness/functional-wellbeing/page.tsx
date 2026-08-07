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
    namespace: "wellness.pages.functional-wellbeing",
  });
  return {
    robots: UNLAUNCHED_ROBOTS,
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/bienestar/bienestar-funcional"
          : "/wellness/functional-wellbeing",
      languages: {
        en: "/wellness/functional-wellbeing",
        es: "/es/bienestar/bienestar-funcional",
        "x-default": "/wellness/functional-wellbeing",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function FunctionalWellbeingPage({
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
      title={isEs ? "Bienestar Funcional" : "Functional Wellbeing"}
      body={
        isEs
          ? "Valoración y entrenamiento para sostener fuerza, movilidad y energía en el tiempo."
          : "Assessment and training to sustain strength, mobility and energy over time."
      }
    />
  );
}
