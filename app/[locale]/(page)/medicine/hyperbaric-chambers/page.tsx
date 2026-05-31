import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import TreatmentSection from "@components/sections/medicine/treatment/treatment-section";
import { treatments } from "@components/sections/medicine/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo";
import { defaultOgImage } from "@/constants/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "medicine.pages.hyperbaric-chambers",
  });
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/medicina/camaras-hiperbaricas"
          : "/medicine/hyperbaric-chambers",
      languages: {
        en: "/medicine/hyperbaric-chambers",
        es: "/es/medicina/camaras-hiperbaricas",
        "x-default": "/medicine/hyperbaric-chambers",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: defaultOgImage,
    },
  };
}

export default async function HyperbaricChambersPage() {
  const t = await getTranslations("medicine.pages");
  const faqs = serviceFaqs["hyperbaric-chambers"];
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
                name: t("hyperbaric-chambers.breadcrumb"),
                url: "/medicine/hyperbaric-chambers",
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
      <TreatmentSection data={treatments["hyperbaric-chambers"]} />
      <ServiceFaq faqs={faqs} serviceSlug="hyperbaric-chambers" />
    </>
  );
}
