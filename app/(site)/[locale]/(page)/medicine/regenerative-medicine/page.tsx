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
    namespace: "medicine.pages.regenerative-medicine",
  });
  return {
    robots: UNLAUNCHED_ROBOTS,
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/medicina/medicina-regenerativa"
          : "/medicine/regenerative-medicine",
      languages: {
        en: "/medicine/regenerative-medicine",
        es: "/es/medicina/medicina-regenerativa",
        "x-default": "/medicine/regenerative-medicine",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function RegenerativePage({
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
      title={isEs ? "Medicina Regenerativa" : "Regenerative Medicine"}
      body={
        isEs
          ? "Tratamientos que activan los mecanismos de reparación del propio cuerpo."
          : "Treatments that activate the body's own repair mechanisms."
      }
    />
  );
}
