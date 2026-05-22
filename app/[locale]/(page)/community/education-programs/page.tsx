import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import EducationSection from "@components/sections/community/education-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.education.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function EducationPage() {
  return <EducationSection />;
}
