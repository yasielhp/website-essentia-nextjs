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

  // TODO: restore the sign-up form when the parent experience goes live.
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
