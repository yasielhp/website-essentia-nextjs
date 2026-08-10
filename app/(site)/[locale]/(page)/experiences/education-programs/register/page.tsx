import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import EducationRegisterSection from "@components/sections/experiences/education-register-section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "experiences.education.register.meta",
  });
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/experiencias/programas-educativos/inscripcion"
          : "/experiences/education-programs/register",
      languages: {
        en: "/experiences/education-programs/register",
        es: "/es/experiencias/programas-educativos/inscripcion",
        "x-default": "/experiences/education-programs/register",
      },
    },
  };
}

export default async function EducationRegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EducationRegisterSection />;
}
