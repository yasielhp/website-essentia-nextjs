import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import TreatmentSection from "@components/sections/medicine/treatment/treatment-section";
import { treatments } from "@components/sections/medicine/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("medicine.pages.intravenous-therapy");
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
  };
}

export default async function IvTherapyPage() {
  const t = await getTranslations("medicine.pages");
  const faqs = serviceFaqs["intravenous-therapy"];
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
      <TreatmentSection data={treatments["intravenous-therapy"]} />
      <ServiceFaq faqs={faqs} serviceSlug="intravenous-therapy" />
    </>
  );
}
