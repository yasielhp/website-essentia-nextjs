import type { Metadata } from "next";

export const revalidate = 3600;
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
    namespace: "experiences.education.meta",
  });
  return {
    robots: UNLAUNCHED_ROBOTS,
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/experiencias/programas-educativos"
          : "/experiences/education-programs",
      languages: {
        en: "/experiences/education-programs",
        es: "/es/experiencias/programas-educativos",
        "x-default": "/experiences/education-programs",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function EducationPage({
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
      title={isEs ? "Educación y Programas" : "Education and Programs"}
      body={
        isEs
          ? "Charlas, talleres y programas para profundizar en tu salud."
          : "Talks, workshops and programmes to deepen your understanding of your health."
      }
    />
  );
}
