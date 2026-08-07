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
    namespace: "medicine.pages.intravenous-therapy",
  });
  return {
    robots: UNLAUNCHED_ROBOTS,
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/medicina/terapia-intravenosa"
          : "/medicine/intravenous-therapy",
      languages: {
        en: "/medicine/intravenous-therapy",
        es: "/es/medicina/terapia-intravenosa",
        "x-default": "/medicine/intravenous-therapy",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function IvTherapyPage({
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
      title={isEs ? "Terapia Intravenosa" : "Intravenous Therapy"}
      body={
        isEs
          ? "Vitaminas, minerales y nutrientes directamente en el torrente sanguíneo."
          : "Vitamins, minerals and nutrients delivered straight into the bloodstream."
      }
    />
  );
}
