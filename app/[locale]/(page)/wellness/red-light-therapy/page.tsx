import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wellness.pages.red-light-therapy");
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
  };
}

export default async function RedLightTherapyPage() {
  const t = await getTranslations("wellness.pages");
  const faqs = serviceFaqs["red-light-therapy"];
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
                name: t("red-light-therapy.breadcrumb"),
                url: "/wellness/red-light-therapy",
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
      <TreatmentSection data={treatments["red-light-therapy"]} />
      <ServiceFaq faqs={faqs} serviceSlug="red-light-therapy" />
    </>
  );
}
