import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import EducationSection from "@components/sections/community/education-section";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community.education.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: locale === "es" ? "/es/community/education-programs" : "/community/education-programs",
      languages: {
        "en": "/community/education-programs",
        "es": "/es/community/education-programs",
        "x-default": "/community/education-programs",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
    },
  };
}

export default function EducationPage() {
  return <EducationSection />;
}
