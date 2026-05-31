import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
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
    namespace: "wellness.pages.contrast-therapy",
  });
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/bienestar/terapia-de-contraste"
          : "/wellness/contrast-therapy",
      languages: {
        en: "/wellness/contrast-therapy",
        es: "/es/bienestar/terapia-de-contraste",
        "x-default": "/wellness/contrast-therapy",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function ContrastTherapyPage() {
  const t = await getTranslations("wellness.pages");
  const faqs = serviceFaqs["contrast-therapy"];
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
                name: t("contrast-therapy.breadcrumb"),
                url: "/wellness/contrast-therapy",
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
      <TreatmentSection data={treatments["contrast-therapy"]} />
      <ServiceFaq faqs={faqs} serviceSlug="contrast-therapy" />
    </>
  );
}
