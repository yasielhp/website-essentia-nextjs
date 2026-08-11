import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
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
    namespace: "experiences.education.register.meta",
  });
  return {
    robots: UNLAUNCHED_ROBOTS,
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
  const isEs = locale === "es";

  return (
    <ComingSoon
      isEs={isEs}
      title={
        isEs
          ? "Inscripción a Programas Educativos"
          : "Education Programs Registration"
      }
      body={
        isEs
          ? "Las inscripciones abrirán con el calendario de la primera temporada."
          : "Registration opens with the first season's calendar."
      }
    />
  );
}
