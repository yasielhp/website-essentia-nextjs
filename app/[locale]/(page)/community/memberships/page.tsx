import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { MembershipsContent } from "./content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("memberships.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

const membershipSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Essentia Membership",
  description:
    "Exclusive wellness club membership with access to longevity programs, running club, and medical services.",
  brand: { "@type": "Brand", name: "Essentia Wellness Club" },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    url: "https://essentiawellnessclub.com/community/memberships",
  },
};

export default function MembershipsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(membershipSchema) }}
      />
      <Suspense>
        <MembershipsContent />
      </Suspense>
    </>
  );
}
