import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import TreatmentSection from "@components/sections/medicine/treatment/treatment-section";
import { treatments } from "@components/sections/medicine/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo";
import { getOgImage } from "@/constants/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "medicine.pages.regenerative-medicine",
  });
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/medicina/medicina-regenerativa"
          : "/medicine/regenerative-medicine",
      languages: {
        en: "/medicine/regenerative-medicine",
        es: "/es/medicina/medicina-regenerativa",
        "x-default": "/medicine/regenerative-medicine",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function RegenerativePage() {
  const t = await getTranslations("medicine.pages");
  const faqs = serviceFaqs["regenerative-medicine"];
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
                name: t("regenerative-medicine.breadcrumb"),
                url: "/medicine/regenerative-medicine",
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
      <TreatmentSection data={treatments["regenerative-medicine"]} />
      <ServiceFaq faqs={faqs} serviceSlug="regenerative-medicine" />
    </>
  );
}
