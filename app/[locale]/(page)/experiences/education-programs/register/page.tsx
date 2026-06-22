import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import EducationRegisterSection from "@components/sections/experiences/education-register-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("experiences.education.register.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function EducationRegisterPage() {
  return <EducationRegisterSection />;
}
