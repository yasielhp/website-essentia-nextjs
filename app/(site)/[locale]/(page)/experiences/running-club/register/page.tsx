import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import RunRegisterSection from "@components/sections/experiences/run-register-section";

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
  return <RunRegisterSection />;
}
