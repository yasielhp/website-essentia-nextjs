import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import AboutSection from "@components/sections/about/about-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function AboutPage() {
  return <AboutSection />;
}
