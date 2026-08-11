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
    namespace: "experiences.runningClub.register.meta",
  });
  return {
    robots: UNLAUNCHED_ROBOTS,
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/experiencias/running-club/inscripcion"
          : "/experiences/running-club/register",
      languages: {
        en: "/experiences/running-club/register",
        es: "/es/experiencias/running-club/inscripcion",
        "x-default": "/experiences/running-club/register",
      },
    },
  };
}

export default async function RunRegisterPage({
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
      title={isEs ? "Inscripción al Running Club" : "Running Club Registration"}
      body={
        isEs
          ? "Las inscripciones abrirán cuando el club eche a andar."
          : "Registration opens when the club starts running."
      }
    />
  );
}
