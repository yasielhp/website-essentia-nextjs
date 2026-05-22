import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wellness.pages.functional-well-being");
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
  };
}

export default async function FunctionalWellnessPage() {
  const t = await getTranslations("wellness.pages");
  const faqs = serviceFaqs["functional-well-being"];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: t("breadcrumbHome"), url: "/" },
              { name: t("breadcrumbWellness"), url: "/wellness" },
              {
                name: t("functional-well-being.breadcrumb"),
                url: "/wellness/functional-well-being",
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
      <TreatmentSection data={treatments["functional-well-being"]} />
      <ServiceFaq faqs={faqs} serviceSlug="functional-well-being" />
    </>
  );
}
