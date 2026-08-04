import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import RunRegisterSection from "@components/sections/experiences/run-register-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("experiences.runningClub.register.meta");
  return {
    title: { absolute: t("title") },
    description: t("description"),
  };
}

export default function RunRegisterPage() {
  return <RunRegisterSection />;
}
