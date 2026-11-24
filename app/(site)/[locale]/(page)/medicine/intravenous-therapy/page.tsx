import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import { bookableServices } from "@/data/services-data";
import { serviceFaqs } from "@/data/service-faqs";
import { shownFaqs } from "@/lib/treatments/faqs";
import { ServiceFaq } from "@components/sections/service-faq";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { JsonLd } from "@/components/json-ld";
import {
  breadcrumbSchema,
  faqPageSchema,
  medicalTherapySchema,
} from "@/lib/seo";
import { listHiddenTreatments } from "@/lib/treatments/public-prices";

// A protocol whose session type is switched off in Settings has no card, and
// one switched back on has its card again: read from the database, so the page
// is rebuilt at most every five minutes (at once when Settings saves). Same
// figure as `TIER_PRICES_REVALIDATE_SECONDS`; Next needs it as a literal.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "medicine.pages.intravenous-therapy",
  });
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/medicina/terapia-intravenosa"
          : "/medicine/intravenous-therapy",
      languages: {
        en: "/medicine/intravenous-therapy",
        es: "/es/medicina/terapia-intravenosa",
        "x-default": "/medicine/intravenous-therapy",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function IvTherapyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("medicine.pages");

  const service = bookableServices.find((s) => s.id === "intravenous-therapy");
  // Never throws, and a read that fails hides nothing.
  const hidden = await listHiddenTreatments("intravenous-therapy");
  // The questions in the page's language, with no hidden treatment named:
  // the list shown and the FAQPage schema are this one list.
  const faqs = shownFaqs(
    "intravenous-therapy",
    serviceFaqs["intravenous-therapy"] ?? [],
    hidden,
    await getTranslations("serviceFaqs"),
  );

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: t("breadcrumbHome"), url: "/" },
          { name: t("breadcrumbMedicine"), url: "/medicine" },
          {
            name: t("intravenous-therapy.breadcrumb"),
            url: "/medicine/intravenous-therapy",
          },
        ])}
      />
      <JsonLd data={faqPageSchema(faqs)} />
      <JsonLd
        data={medicalTherapySchema({
          name: service?.title ?? "intravenous-therapy",
          description: service?.description ?? "",
          url: "/medicine/intravenous-therapy",
          category: "medicine",
        })}
      />
      <TreatmentSection
        data={treatments["intravenous-therapy"]!}
        hiddenIds={hidden}
      />
      <ServiceFaq faqs={faqs} />
    </>
  );
}
