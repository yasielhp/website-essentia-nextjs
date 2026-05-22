import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import RunRegisterSection from "@components/sections/community/run-register-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.runningClub.register.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function RunRegisterPage() {
  return <RunRegisterSection />;
}
