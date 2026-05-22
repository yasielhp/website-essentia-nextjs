import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import RunningClubSection from "@components/sections/community/running-club-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.runningClub.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function RunningClubPage() {
  return <RunningClubSection />;
}
