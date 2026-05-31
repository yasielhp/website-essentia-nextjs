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

const runningClubSchema = {
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  name: "Essentia Running Club — Saturday Run",
  description:
    "Weekly coastal running group in Costa Adeje. All fitness levels welcome.",
  organizer: { "@type": "Organization", name: "Essentia Wellness Club" },
  location: {
    "@type": "Place",
    name: "Costa Adeje, Tenerife",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Costa Adeje",
      addressRegion: "Tenerife",
      addressCountry: "ES",
    },
  },
  eventSchedule: {
    "@type": "Schedule",
    repeatFrequency: "P1W",
    byDay: "https://schema.org/Saturday",
  },
};

export default function RunningClubPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(runningClubSchema) }}
      />
      <RunningClubSection />
    </>
  );
}
