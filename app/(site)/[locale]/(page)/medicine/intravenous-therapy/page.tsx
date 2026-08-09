import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import { bookableServices } from "@/data/services-data";
import { serviceFaqs } from "@/data/service-faqs";
import { ServiceFaq } from "@components/sections/service-faq";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import {
  breadcrumbSchema,
  faqPageSchema,
  medicalTherapySchema,
} from "@/lib/seo";

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

  const faqs = serviceFaqs["intravenous-therapy"];
  const service = bookableServices.find((s) => s.id === "intravenous-therapy");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: t("breadcrumbHome"), url: "/" },
              { name: t("breadcrumbMedicine"), url: "/medicine" },
              {
                name: t("intravenous-therapy.breadcrumb"),
                url: "/medicine/intravenous-therapy",
              },
            ]),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqPageSchema(faqs)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            medicalTherapySchema({
              name: service?.title ?? "intravenous-therapy",
              description: service?.description ?? "",
              url: "/medicine/intravenous-therapy",
              category: "medicine",
            }),
          ),
        }}
      />
      <TreatmentSection data={treatments["intravenous-therapy"]!} />
      <ServiceFaq faqs={faqs} serviceSlug="intravenous-therapy" />
    </>
  );
}
