import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { bookableServices, facialTreatments } from "@/data/services-data";
import {
  breadcrumbSchema,
  faqPageSchema,
  medicalTherapySchema,
} from "@/lib/seo";
import { getOgImage } from "@/constants/metadata";
import { JsonLd } from "@/components/json-ld";
import { cardLines } from "@/lib/treatments/prices";
import { listPublicTierPrices } from "@/lib/treatments/public-prices";

// The cards print the price of each session type, which the centre changes
// from the dashboard: the page is rebuilt at most every five minutes so a new
// price shows without a deploy. Same figure as
// `TIER_PRICES_REVALIDATE_SECONDS`; Next needs it written here as a literal.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "wellness.pages.facial-therapies",
  });
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/bienestar/terapias-faciales"
          : "/wellness/facial-therapies",
      languages: {
        en: "/wellness/facial-therapies",
        es: "/es/bienestar/terapias-faciales",
        "x-default": "/wellness/facial-therapies",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function FacialTherapiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("wellness.pages");
  const faqs = serviceFaqs["facial-therapies"];
  const service = bookableServices.find((s) => s.id === "facial-therapies");
  // Read here, on the server, so each card arrives with its price in the
  // HTML. Never throws: with no prices the cards show their duration alone.
  const prices = await listPublicTierPrices("facial-therapies");
  const lines = cardLines(
    facialTreatments,
    prices,
    locale === "es" ? "es" : "en",
  );
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: t("breadcrumbHome"), url: "/" },
          { name: t("breadcrumbWellness"), url: "/wellness" },
          {
            name: t("facial-therapies.breadcrumb"),
            url: "/wellness/facial-therapies",
          },
        ])}
      />
      <JsonLd data={faqPageSchema(faqs)} />
      <JsonLd
        data={medicalTherapySchema({
          name: service?.title ?? "facial-therapies",
          description: service?.description ?? "",
          url: "/wellness/facial-therapies",
          category: "wellness",
        })}
      />
      <TreatmentSection
        data={treatments["facial-therapies"]}
        cardLines={lines}
      />
      <ServiceFaq faqs={faqs} serviceSlug="facial-therapies" />
    </>
  );
}
