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
    namespace: "wellness.pages.contrast-therapy",
  });
  return {
    robots: UNLAUNCHED_ROBOTS,
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/bienestar/terapia-de-contraste"
          : "/wellness/contrast-therapy",
      languages: {
        en: "/wellness/contrast-therapy",
        es: "/es/bienestar/terapia-de-contraste",
        "x-default": "/wellness/contrast-therapy",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function ContrastTherapyPage({
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
      title={isEs ? "Contraste Térmico" : "Thermal Contrast"}
      body={
        isEs
          ? "Alternancia de calor y frío para acelerar la recuperación y activar el sistema nervioso."
          : "Heat and cold in sequence to speed up recovery and wake up the nervous system."
      }
    />
  );
}
