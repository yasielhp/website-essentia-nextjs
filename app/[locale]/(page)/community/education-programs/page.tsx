import type { Metadata } from "next";

export const revalidate = 3600;
import { getTranslations } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import EducationSection from "@components/sections/community/education-section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "community.education.meta",
  });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/comunidad/programas-educativos"
          : "/community/education-programs",
      languages: {
        en: "/community/education-programs",
        es: "/es/comunidad/programas-educativos",
        "x-default": "/community/education-programs",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default function EducationPage() {
  return <EducationSection />;
}
