import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
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
    namespace: "wellness.pages.breathing-sessions",
  });
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/bienestar/sesiones-de-respiracion"
          : "/wellness/breathing-sessions",
      languages: {
        en: "/wellness/breathing-sessions",
        es: "/es/bienestar/sesiones-de-respiracion",
        "x-default": "/wellness/breathing-sessions",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: defaultOgImage,
    },
  };
}

export default async function BreathworkPage() {
  const t = await getTranslations("wellness.pages");
  const faqs = serviceFaqs["breathing-sessions"];
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
                name: t("breathing-sessions.breadcrumb"),
                url: "/wellness/breathing-sessions",
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
      <TreatmentSection data={treatments["breathing-sessions"]} />
      <ServiceFaq faqs={faqs} serviceSlug="breathing-sessions" />
    </>
  );
}
