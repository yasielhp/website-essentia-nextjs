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

const educationSchema = {
  "@context": "https://schema.org",
  "@type": "Course",
  name: "Essentia Education Programs",
  description:
    "Monthly masterclasses with leading researchers, clinicians, and longevity practitioners.",
  provider: {
    "@type": "Organization",
    name: "Essentia Wellness Club",
    url: "https://essentiawellnessclub.com",
  },
  courseMode: "onsite",
  inLanguage: ["es", "en"],
};

export default function EducationPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(educationSchema) }}
      />
      <EducationSection />
    </>
  );
}
