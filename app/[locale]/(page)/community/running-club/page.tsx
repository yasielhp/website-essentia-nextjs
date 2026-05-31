import type { Metadata } from "next";

export const revalidate = 3600;
import { getTranslations } from "next-intl/server";
import RunningClubSection from "@components/sections/community/running-club-section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "community.runningClub.meta",
  });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/community/running-club"
          : "/community/running-club",
      languages: {
        en: "/community/running-club",
        es: "/es/community/running-club",
        "x-default": "/community/running-club",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
    },
  };
}

export default function RunningClubPage() {
  return <RunningClubSection />;
}
